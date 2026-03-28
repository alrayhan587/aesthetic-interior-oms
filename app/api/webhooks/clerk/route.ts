import { NextResponse } from "next/server";
import { Webhook } from "svix";
import prisma from "@/lib/prisma";

const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") {
    // console.log(...args);
  }
};

debugLog("🚀 [CLERK-WEBHOOK] Module loaded - webhook route initialized");

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
  debugLog(`${logPrefix} phase=request_start timestamp=${requestTimestamp}`);

  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error(`${logPrefix} phase=config_error reason=missing_webhook_secret`);
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 });
  }

  const payload = await req.text();
  debugLog(`${logPrefix} phase=payload_received length=${payload.length} timestamp=${requestTimestamp}`);
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  debugLog(`${logPrefix} phase=headers_received svix_id=${svixId} svix_timestamp=${svixTimestamp} svix_signature_present=${Boolean(
    svixSignature,
  )} timestamp=${requestTimestamp}`,
  );

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error(
      `${logPrefix} phase=missing_headers svix_id=${Boolean(
        svixId,
      )} svix_timestamp=${Boolean(svixTimestamp)} svix_signature=${Boolean(svixSignature)}`,
    );
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
    console.error(`${logPrefix} phase=verify_failed`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  debugLog(
    `${logPrefix} phase=verify_success event_type=${event.type} event_user_id=${String(
      event.data?.id ?? "null",
    )}`,
  );

  if (event.type === "user.created" || event.type === "user.updated") {
    debugLog(`${logPrefix} phase=direct_user_event type=${event.type}`);
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
      console.error(`${logPrefix} phase=missing_user_id type=${event.type}`);
      return NextResponse.json({ error: "Missing required user data in webhook payload" }, { status: 400 });
    }

    const fullName = [first_name, last_name].filter(Boolean).join(" ").trim() || "Unknown User";
    const phone = phone_numbers?.[0]?.phone_number ?? "";
    const resolvedEmail = primaryEmail ?? `${id}@clerk.local`;
    debugLog(
      `${logPrefix} phase=normalized_user clerk_user_id=${id} email=${resolvedEmail} has_phone=${Boolean(
        phone,
      )}`,
    );

    const { roleNames, departmentNames } = extractMembershipNames({
      public_metadata,
      unsafe_metadata,
    });
    debugLog(
      `${logPrefix} phase=membership_extracted role_count=${roleNames.length} department_count=${departmentNames.length}`,
    );

    const hasAnyMembershipData = roleNames.length > 0 || departmentNames.length > 0;
    if (hasAnyMembershipData && (roleNames.length === 0 || departmentNames.length === 0)) {
      console.error(`${logPrefix} phase=membership_validation_failed`);
      return NextResponse.json(
        {
          error:
            "When sending membership metadata, include both roleNames[] and departmentNames[]",
        },
        { status: 400 },
      );
    }

    try {
      debugLog(`${logPrefix} phase=db_upsert_start clerk_user_id=${id}`);
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

      debugLog(
        `${logPrefix} phase=user_upsert_success clerk_user_id=${id} db_user_id=${result.id} role_count=${roleNames.length} department_count=${departmentNames.length} timestamp=${requestTimestamp}`,
      );
    } catch (dbError) {
      const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
      console.error(`${logPrefix} phase=db_upsert_error clerk_user_id=${id} error=${errorMsg}`);
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
      debugLog(`${logPrefix} phase=user_deleted clerk_user_id=${clerkUserId}`);
      try {
        await prisma.user.updateMany({
          where: { clerkUserId },
          data: { clerkUserId: null },
        });
      } catch (dbError) {
        const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
        console.error(`${logPrefix} phase=user_deleted_error clerk_user_id=${clerkUserId} error=${errorMsg}`);
        return NextResponse.json({ error: "Database error during delete", details: errorMsg }, { status: 500 });
      }
    }
  }

  debugLog(`${logPrefix} phase=request_success type=${event.type}`);
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
