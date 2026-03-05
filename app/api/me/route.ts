import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log(`[me] phase=start timestamp=${new Date().toISOString()}`);

    const { userId } = await auth();
    console.log(`[me] phase=auth_complete userId=${userId || "null"}`);

    // If the user is not logged in, return an unauthorized response
    if (!userId) {
      console.log(`[me] phase=auth_failed reason=no_user_id`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[me] phase=db_query_start userId=${userId}`);

    // Find user in DB
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: {
        userRoles: { include: { role: true } },
        userDepartments: { include: { department: true } },
      },
    });

    console.log(`[me] phase=db_query_complete userId=${userId} userFound=${Boolean(user)} userObject=${user ? JSON.stringify({ id: user.id, email: user.email }) : "null"}`);

    // If we can't find the user in the database, return a not found response
    if (!user) {
      console.log(`[me] phase=user_not_found userId=${userId} clerkUserId=${userId}`);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log(`[me] phase=success userId=${userId} userName=${user.fullName} userEmail=${user.email}`);
    return NextResponse.json(user);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(`[me] phase=error error_message=${errorMessage} error_type=${error?.constructor?.name || "unknown"}`);
    console.error(`[me] phase=error_detail stack=${errorStack}`);
    return NextResponse.json({ error: "Internal Server Error", details: errorMessage }, { status: 500 });
  }
}
