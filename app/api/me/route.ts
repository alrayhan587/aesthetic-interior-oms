import prisma from "@/lib/prisma";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

type UpdateMeBody = {
  departmentId?: unknown;
};

const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") {
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

export async function GET() {
  try {
    debugLog(`[GET /me] ========== REQUEST START ==========`);
    debugLog(`[GET /me] phase=start timestamp=${new Date().toISOString()}`);

    const { userId } = await auth();
    debugLog(`[GET /me] phase=auth_complete userId=${userId || "null"}`);
    debugLog(`[GET /me] userId type: ${typeof userId}`);

    // If the user is not logged in, return an unauthorized response
    if (!userId) {
      debugLog(`[GET /me] phase=auth_failed reason=no_user_id`);
      debugLog(`[GET /me] Returning 401 Unauthorized`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    debugLog(`[GET /me] phase=db_query_start userId=${userId}`);
    debugLog(`[GET /me] Querying user with clerkUserId: ${userId}`);

    // Find user in DB
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: {
        userRoles: { include: { role: true } },
        userDepartments: { include: { department: true } },
      },
    });

    debugLog(`[GET /me] phase=db_query_complete`);
    debugLog(`[GET /me] userFound=${Boolean(user)}`);
    if (user) {
      debugLog(`[GET /me] User data:`, JSON.stringify({ 
        id: user.id, 
        email: user.email, 
        fullName: user.fullName,
        rolesCount: user.userRoles?.length || 0,
        departmentsCount: user.userDepartments?.length || 0
      }));
    }

    // If we can't find the user in the database, return a not found response
    if (!user) {
      debugLog(`[GET /me] phase=user_not_found userId=${userId} clerkUserId=${userId}`);
      debugLog(`[GET /me] Creating new user for clerkUserId: ${userId}`);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const needsOnboarding = user.userDepartments.length === 0;
    debugLog(`[GET /me] needsOnboarding=${needsOnboarding} (departments: ${user.userDepartments.length})`);
    debugLog(
      `[GET /me] phase=success userId=${userId} userName=${user.fullName} userEmail=${user.email} needsOnboarding=${needsOnboarding}`,
    );
    debugLog(`[GET /me] ========== REQUEST SUCCESS ==========`);
    return NextResponse.json({ ...user, needsOnboarding });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(`[GET /me] phase=error error_message=${errorMessage} error_type=${error?.constructor?.name || "unknown"}`);
    console.error(`[GET /me] phase=error_detail stack=${errorStack}`);
    console.error(`[GET /me] ========== REQUEST ERROR ==========`);
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

    debugLog(`[PATCH /me] Starting transaction for userId: ${userId}, departmentId: ${departmentId}`);

    const updated = await prisma.$transaction(async (tx) => {
      debugLog(`[PATCH /me] [TX] Finding user in database...`);
      const user = await tx.user.findUnique({
        where: { clerkUserId: userId },
        select: { id: true },
      });

      if (!user) {
        debugLog(`[PATCH /me] [TX] User not found for clerkUserId: ${userId}`);
        throw new Error("USER_NOT_FOUND");
      }

      debugLog(`[PATCH /me] [TX] Found user: ${user.id}`);

      debugLog(`[PATCH /me] [TX] Checking if department exists...`);
      const department = await tx.department.findUnique({
        where: { id: departmentId },
        select: { id: true },
      });

      if (!department) {
        debugLog(`[PATCH /me] [TX] Department not found: ${departmentId}`);
        throw new Error("DEPARTMENT_NOT_FOUND");
      }

      debugLog(`[PATCH /me] [TX] Found department: ${department.id}`);

      debugLog(`[PATCH /me] [TX] Deleting existing user departments...`);
      const deleteResult = await tx.userDepartment.deleteMany({ where: { userId: user.id } });
      debugLog(`[PATCH /me] [TX] Deleted ${deleteResult.count} existing department assignments`);

      debugLog(`[PATCH /me] [TX] Creating new user department assignment...`);
      await tx.userDepartment.create({
        data: { userId: user.id, departmentId: department.id },
      });
      debugLog(`[PATCH /me] [TX] Created new assignment`);

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
    debugLog(`[PATCH /me] ========== REQUEST ERROR ==========`);
    return NextResponse.json({ error: "Failed to update user department", details: message }, { status: 500 });
  }
}
