import prisma from "@/lib/prisma";

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { formatServerTiming, timeAsync } from "@/lib/server-timing";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

type UpdateMeBody = {
  departmentId?: unknown;
};

const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") {
    void args;
    // console.log(...args);
  }
};

function toOptionalString(value: unknown): string | null {
  debugLog(`[toOptionalString] Converting value: ${typeof value}`, value);
  if (typeof value !== "string") {
    debugLog(`[toOptionalString] Value is not string, returning null`);
    return null;
  }
  const trimmed = value.trim();
  const result = trimmed.length > 0 ? trimmed : null;
  debugLog(`[toOptionalString] Result: ${result}`);
  return result;
}

async function parseJsonBody(request: Request): Promise<UpdateMeBody | null> {
  try {
    debugLog(`[parseJsonBody] Attempting to parse request body`);
    const parsed = (await request.json()) as UpdateMeBody;
    debugLog(`[parseJsonBody] Successfully parsed body:`, JSON.stringify(parsed));
    return parsed;
  } catch (error) {
    console.error(`[parseJsonBody] Failed to parse JSON:`, error);
    return null;
  }
}

async function hasActiveAdminDepartmentUser() {
  const adminMember = await prisma.userDepartment.findFirst({
    where: {
      department: { name: "ADMIN" },
      user: { isActive: true },
    },
    select: { userId: true },
  });

  return Boolean(adminMember);
}

async function findCurrentDbUserByClerkId(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkUserId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      isActive: true,
      clerkUserId: true,
      created_at: true,
      updated_at: true,
      userRoles: {
        select: {
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      userDepartments: {
        select: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });
}

async function ensureLocalUserFromClerk(clerkUserId: string) {
  const existing = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const clerk = await currentUser();
  if (!clerk || clerk.id !== clerkUserId) {
    return null;
  }

  const primaryEmail =
    clerk.emailAddresses.find((item) => item.id === clerk.primaryEmailAddressId)?.emailAddress ??
    clerk.emailAddresses[0]?.emailAddress ??
    `${clerk.id}@clerk.local`;

  const phone =
    clerk.phoneNumbers.find((item) => item.id === clerk.primaryPhoneNumberId)?.phoneNumber ??
    clerk.phoneNumbers[0]?.phoneNumber ??
    "";

  const firstName = clerk.firstName?.trim() ?? "";
  const lastName = clerk.lastName?.trim() ?? "";
  const fullName =
    `${firstName} ${lastName}`.trim() ||
    clerk.username?.trim() ||
    primaryEmail.split("@")[0] ||
    "Unknown User";

  const existingByEmail = await prisma.user.findUnique({
    where: { email: primaryEmail },
    select: { id: true },
  });

  if (existingByEmail) {
    const linked = await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        clerkUserId,
        fullName,
        phone,
      },
      select: { id: true },
    });
    return linked.id;
  }

  try {
    const created = await prisma.user.create({
      data: {
        clerkUserId,
        fullName,
        email: primaryEmail,
        phone,
      },
      select: { id: true },
    });
    return created.id;
  } catch {
    // Handle concurrent bootstrap races by re-reading canonical keys.
    const raceResolved =
      (await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true },
      })) ??
      (await prisma.user.findUnique({
        where: { email: primaryEmail },
        select: { id: true },
      }));
    return raceResolved?.id ?? null;
  }
}

export async function GET() {
  const requestStart = performance.now();
  try {
    const timedAuth = await timeAsync(async () => auth());
    const { userId } = timedAuth.value;

    // If the user is not logged in, return an unauthorized response
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find user in DB
    const timedDb = await timeAsync(async () => findCurrentDbUserByClerkId(userId));
    let user = timedDb.value;
    const timedProvision = await timeAsync(async () => {
      if (user) return false;
      const createdOrLinkedUserId = await ensureLocalUserFromClerk(userId);
      if (!createdOrLinkedUserId) return false;
      user = await findCurrentDbUserByClerkId(userId);
      return Boolean(user);
    });
    // If we can't find the user in the database, return a not found response
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const needsOnboarding = user.userDepartments.length === 0;
    const hasAdminDepartment = user.userDepartments.some(
      (row) => row.department.name === "ADMIN",
    );
    const shouldCheckBootstrapAdmin =
      needsOnboarding && user.isActive && !hasAdminDepartment;
    let activeAdminExists = false;
    let adminCheckDurationMs = 0;
    if (shouldCheckBootstrapAdmin) {
      const timedAdminCheck = await timeAsync(async () => hasActiveAdminDepartmentUser());
      activeAdminExists = timedAdminCheck.value;
      adminCheckDurationMs = timedAdminCheck.durationMs;
    }

    const isRejected = needsOnboarding && !user.isActive;
    const bootstrapMode =
      needsOnboarding &&
      user.isActive &&
      !hasAdminDepartment &&
      !activeAdminExists;
    const requiresAdminApproval =
      needsOnboarding && user.isActive && !hasAdminDepartment && !bootstrapMode;
    const response = NextResponse.json({
      ...user,
      needsOnboarding,
      canSelfAssignDepartment: hasAdminDepartment || bootstrapMode,
      bootstrapMode,
      requiresAdminApproval,
      isRejected,
      accountStatus: isRejected
        ? "REJECTED"
        : requiresAdminApproval
          ? "PENDING_APPROVAL"
          : "ACTIVE",
    });
    const totalDurationMs = performance.now() - requestStart;
    response.headers.set(
      "Server-Timing",
      [
        formatServerTiming("auth", timedAuth.durationMs, "clerk auth"),
        formatServerTiming("db", timedDb.durationMs, "user lookup"),
        formatServerTiming("user_bootstrap", timedProvision.durationMs, "local user bootstrap"),
        formatServerTiming(
          "admin_check",
          adminCheckDurationMs,
          shouldCheckBootstrapAdmin ? "bootstrap check" : "skipped",
        ),
        formatServerTiming("total", totalDurationMs, "request total"),
      ].join(", "),
    );
    response.headers.set("Cache-Control", "private, max-age=15, stale-while-revalidate=45");
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[GET /me] phase=error error_message=${errorMessage} error_type=${error?.constructor?.name || "unknown"}`);
    return NextResponse.json({ error: "Internal Server Error", details: errorMessage }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    debugLog(`[PATCH /me] ========== REQUEST START ==========`);
    debugLog(`[PATCH /me] Timestamp: ${new Date().toISOString()}`);

    const { userId } = await auth();
    debugLog(`[PATCH /me] Auth userId: ${userId || "null"}`);

    if (!userId) {
      debugLog(`[PATCH /me] No userId found, returning 401`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    debugLog(`[PATCH /me] Parsing request body...`);
    const body = await parseJsonBody(req);
    
    if (!body) {
      debugLog(`[PATCH /me] body is null, returning 400`);
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    debugLog(`[PATCH /me] Extracted departmentId from body:`, body.departmentId);
    const departmentId = toOptionalString(body.departmentId);
    
    if (!departmentId) {
      debugLog(`[PATCH /me] departmentId is empty or invalid, returning 400`);
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 });
    }

    await ensureLocalUserFromClerk(userId);

    debugLog(`[PATCH /me] Starting transaction for userId: ${userId}, departmentId: ${departmentId}`);

    const updated = await prisma.$transaction(async (tx) => {
      debugLog(`[PATCH /me] [TX] Finding user in database...`);
      const user = await tx.user.findUnique({
        where: { clerkUserId: userId },
        select: {
          id: true,
          isActive: true,
          userDepartments: {
            select: {
              department: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (!user) {
        debugLog(`[PATCH /me] [TX] User not found for clerkUserId: ${userId}`);
        throw new Error("USER_NOT_FOUND");
      }

      debugLog(`[PATCH /me] [TX] Found user: ${user.id}`);

      const hasAdminDepartment = user.userDepartments.some(
        (row) => row.department.name === "ADMIN",
      );
      const activeAdminMember = await tx.userDepartment.findFirst({
        where: {
          department: { name: "ADMIN" },
          user: { isActive: true },
        },
        select: { userId: true },
      });
      const isBootstrapSelfAssignment = !hasAdminDepartment && !activeAdminMember;
      if (!hasAdminDepartment && !isBootstrapSelfAssignment) {
        throw new Error("ADMIN_APPROVAL_REQUIRED");
      }
      if (!user.isActive) {
        throw new Error("ACCOUNT_DISABLED");
      }

      debugLog(`[PATCH /me] [TX] Checking if department exists...`);
      const department = await tx.department.findUnique({
        where: { id: departmentId },
        select: { id: true, name: true },
      });

      if (!department) {
        debugLog(`[PATCH /me] [TX] Department not found: ${departmentId}`);
        throw new Error("DEPARTMENT_NOT_FOUND");
      }

      debugLog(`[PATCH /me] [TX] Found department: ${department.id}`);

      debugLog(`[PATCH /me] [TX] Deleting existing user departments...`);
      const deleteResult = await tx.userDepartment.deleteMany({ where: { userId: user.id } });
      debugLog(`[PATCH /me] [TX] Deleted ${deleteResult.count} existing department assignments`);

      const departmentIds = new Set<string>([department.id]);
      if (isBootstrapSelfAssignment) {
        // First onboarding user becomes system bootstrap admin to avoid approval deadlock.
        const adminDepartment = await tx.department.upsert({
          where: { name: "ADMIN" },
          update: {},
          create: {
            name: "ADMIN",
            description: "System administration",
          },
          select: { id: true },
        });
        departmentIds.add(adminDepartment.id);

        let adminRole = await tx.role.findFirst({
          where: {
            name: {
              equals: "admin",
              mode: "insensitive",
            },
          },
          select: { id: true },
        });

        if (!adminRole) {
          adminRole = await tx.role.create({
            data: {
              name: "Admin",
              description: "System bootstrap administrator",
            },
            select: { id: true },
          });
        }

        await tx.userRole.upsert({
          where: {
            userId_roleId: {
              userId: user.id,
              roleId: adminRole.id,
            },
          },
          update: {},
          create: {
            userId: user.id,
            roleId: adminRole.id,
          },
        });

        await tx.user.update({
          where: { id: user.id },
          data: {
            isActive: true,
            approvedById: user.id,
            approvedAt: new Date(),
          },
        });
      }

      debugLog(`[PATCH /me] [TX] Creating new user department assignment...`);
      await tx.userDepartment.createMany({
        data: Array.from(departmentIds).map((id) => ({
          userId: user.id,
          departmentId: id,
        })),
        skipDuplicates: true,
      });
      debugLog(`[PATCH /me] [TX] Created new assignment(s)`);

      debugLog(`[PATCH /me] [TX] Fetching updated user with relations...`);
      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        include: {
          userRoles: { include: { role: true } },
          userDepartments: { include: { department: true } },
        },
      });
    });

    const needsOnboarding = updated.userDepartments.length === 0;
    debugLog(`[PATCH /me] Transaction completed successfully`);
    debugLog(`[PATCH /me] Updated user:`, JSON.stringify({
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      departmentsCount: updated.userDepartments.length,
      rolesCount: updated.userRoles.length,
    }));
    debugLog(`[PATCH /me] ========== REQUEST SUCCESS ==========`);
    return NextResponse.json({ ...updated, needsOnboarding });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[PATCH /me] Error caught: ${message}`);
    console.error(`[PATCH /me] Error type: ${error?.constructor?.name || "unknown"}`);
    console.error(`[PATCH /me] Full error:`, error);

    if (message.includes("USER_NOT_FOUND")) {
      debugLog(`[PATCH /me] Returning 404 - User not found`);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (message.includes("DEPARTMENT_NOT_FOUND")) {
      debugLog(`[PATCH /me] Returning 404 - Department not found`);
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }
    if (message.includes("ADMIN_APPROVAL_REQUIRED")) {
      return NextResponse.json(
        { error: "Account setup requires admin approval. Please contact an administrator." },
        { status: 403 },
      );
    }
    if (message.includes("ACCOUNT_DISABLED")) {
      return NextResponse.json(
        { error: "Your account is blocked. Please contact an administrator." },
        { status: 403 },
      );
    }
    debugLog(`[PATCH /me] ========== REQUEST ERROR ==========`);
    return NextResponse.json({ error: "Failed to update user department", details: message }, { status: 500 });
  }
}
