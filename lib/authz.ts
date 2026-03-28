import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type RoleCheckSuccess = {
  ok: true;
  actorUserId: string;
  clerkUserId: string;
  actorRoles: string[];
  actor: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    clerkUserId: string | null;
    userDepartments: string[];
  };
};

type RoleCheckFailure = {
  ok: false;
  response: NextResponse;
};

export type RoleCheckResult = RoleCheckSuccess | RoleCheckFailure;

export async function requireDatabaseRoles(allowedRoles: string[]): Promise<RoleCheckResult> {
  const { userId } = await auth();
  // console.log('[authz] requireDatabaseRoles called with allowedRoles:', allowedRoles);
  // console.log('[authz] clerkUserId:', userId);

  if (!userId) {
    // console.log('[authz] No userId from Clerk - returning 401');
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const actor = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      clerkUserId: true,
      userRoles: {
        select: {
          role: {
            select: { name: true },
          },
        },
      },
      userDepartments: {
        select: {
          department: {
            select: { name: true },
          },
        },
      },
    },
  });
  // console.log('[authz] actor from database:', actor);

  if (!actor) {
    // console.log('[authz] No actor found in database - returning 403');
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden: no linked local user account" },
        { status: 403 },
      ),
    };
  }

  const actorRoles = actor.userRoles.map((item) => item.role.name);
  // console.log('[authz] actorRoles extracted:', actorRoles);
  
  // If allowedRoles is specified (not empty), check if user has one of those roles
  if (allowedRoles.length > 0) {
    const hasAllowedRole = allowedRoles.some((role) => actorRoles.includes(role));
    // console.log('[authz] hasAllowedRole check:', { allowedRoles, actorRoles, hasAllowedRole });

    if (!hasAllowedRole) {
      // console.log('[authz] User does not have allowed role - returning 403');
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  } else {
    // console.log('[authz] No role restrictions - allowedRoles is empty, allowing authenticated user');
  }

  // console.log('[authz] Authorization successful for user:', actor.id);
  return {
    ok: true,
    actorUserId: actor.id,
    clerkUserId: userId,
    actorRoles,
    actor: {
      id: actor.id,
      fullName: actor.fullName,
      email: actor.email,
      phone: actor.phone,
      clerkUserId: actor.clerkUserId,
      userDepartments: (actor.userDepartments ?? []).map((item) => item.department.name),
    },
  };
}
