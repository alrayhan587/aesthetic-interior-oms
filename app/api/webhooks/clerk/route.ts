import { NextResponse } from "next/server";
import { Webhook } from "svix";
import prisma from "@/lib/prisma";

console.log("🚀 [CLERK-WEBHOOK] Module loaded - webhook route initialized");

type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

type ClerkPhoneNumber = {
  phone_number: string;
};

type ClerkUserData = {
  id?: string;
  email_addresses?: ClerkEmailAddress[];
  first_name?: string | null;
  last_name?: string | null;
  phone_numbers?: ClerkPhoneNumber[];
  primary_email_address_id?: string | null;
  public_metadata?: Record<string, unknown>;
  unsafe_metadata?: Record<string, unknown>;
};

type ClerkWebhookEvent = {
  type: string;
  data: ClerkUserData;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const extractMembershipNames = (data: ClerkUserData) => {
  const metadata = [data.public_metadata, data.unsafe_metadata];

  const roleNames = metadata.flatMap((record) => normalizeStringArray(record?.roleNames));
  const departmentNames = metadata.flatMap((record) =>
    normalizeStringArray(record?.departmentNames),
  );

  return {
    roleNames: [...new Set(roleNames)],
    departmentNames: [...new Set(departmentNames)],
  };
};

export async function POST(req: Request) {
  const logPrefix = "[clerk-webhook]";
  const requestTimestamp = new Date().toISOString();

  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 });
  }

  const payload = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing Svix headers" }, { status: 400 });
  }

  const wh = new Webhook(webhookSecret);

  let event: ClerkWebhookEvent;

  try {
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const {
      id,
      email_addresses,
      first_name,
      last_name,
      phone_numbers,
      primary_email_address_id,
      public_metadata,
      unsafe_metadata,
    } = event.data;

    const primaryEmail =
      email_addresses?.find((email) => email.id === primary_email_address_id)?.email_address ??
      email_addresses?.[0]?.email_address;

    if (!id) {
      return NextResponse.json({ error: "Missing required user data in webhook payload" }, { status: 400 });
    }

    const fullName = [first_name, last_name].filter(Boolean).join(" ").trim() || "Unknown User";
    const phone = phone_numbers?.[0]?.phone_number ?? "";
    const resolvedEmail = primaryEmail ?? `${id}@clerk.local`;

    const { roleNames, departmentNames } = extractMembershipNames({
      public_metadata,
      unsafe_metadata,
    });

    const hasAnyMembershipData = roleNames.length > 0 || departmentNames.length > 0;
    if (hasAnyMembershipData && (roleNames.length === 0 || departmentNames.length === 0)) {
      return NextResponse.json(
        {
          error:
            "When sending membership metadata, include both roleNames[] and departmentNames[]",
        },
        { status: 400 },
      );
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: { clerkUserId: id },
          update: {
            fullName,
            email: resolvedEmail,
            phone,
          },
          create: {
            clerkUserId: id,
            fullName,
            email: resolvedEmail,
            phone,
          },
        });

        if (!hasAnyMembershipData) {
          console.warn(
            `${logPrefix} phase=membership_skipped clerk_user_id=${id} reason=no_role_or_department_metadata timestamp=${requestTimestamp}`,
          );
          return user;
        }

        const roles = await tx.role.findMany({
          where: { name: { in: roleNames } },
          select: { id: true, name: true },
        });

        if (roles.length !== roleNames.length) {
          const found = new Set(roles.map((role) => role.name));
          const missing = roleNames.filter((name) => !found.has(name));
          throw new Error(`Unknown role(s): ${missing.join(", ")}`);
        }

        const departments = await tx.department.findMany({
          where: { name: { in: departmentNames } },
          select: { id: true, name: true },
        });

        if (departments.length !== departmentNames.length) {
          const found = new Set(departments.map((department) => department.name));
          const missing = departmentNames.filter((name) => !found.has(name));
          throw new Error(`Unknown department(s): ${missing.join(", ")}`);
        }

        await tx.userRole.deleteMany({ where: { userId: user.id } });
        await tx.userDepartment.deleteMany({ where: { userId: user.id } });

        await tx.userRole.createMany({
          data: roles.map((role) => ({ userId: user.id, roleId: role.id })),
          skipDuplicates: true,
        });

        await tx.userDepartment.createMany({
          data: departments.map((department) => ({
            userId: user.id,
            departmentId: department.id,
          })),
          skipDuplicates: true,
        });

        return user;
      });

      console.log(
        `${logPrefix} phase=user_upsert_success clerk_user_id=${id} db_user_id=${result.id} role_count=${roleNames.length} department_count=${departmentNames.length} timestamp=${requestTimestamp}`,
      );
    } catch (dbError) {
      const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
      const isMembershipValidationError =
        errorMsg.includes("Unknown role(s)") || errorMsg.includes("Unknown department(s)");

      return NextResponse.json(
        isMembershipValidationError
          ? { error: errorMsg }
          : { error: "Database error during upsert", details: errorMsg },
        { status: isMembershipValidationError ? 400 : 500 },
      );
    }
  }

  if (event.type === "user.deleted") {
    const clerkUserId = event.data?.id as string | undefined;

    if (clerkUserId) {
      try {
        await prisma.user.updateMany({
          where: { clerkUserId },
          data: { clerkUserId: null },
        });
      } catch (dbError) {
        const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
        return NextResponse.json({ error: "Database error during delete", details: errorMsg }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  const timestamp = new Date().toISOString();

  return NextResponse.json({
    status: "ok",
    message: "Clerk webhook endpoint is reachable",
    timestamp,
    configurations: {
      webhookSecretSet: !!process.env.CLERK_WEBHOOK_SECRET,
      nodeEnv: process.env.NODE_ENV,
    },
  });
}
