import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

type CreateUserBody = {
  fullName?: string;
  email?: string;
  phone?: string;
  clerkUserId?: string | null;
  roleNames?: string[];
  departmentNames?: string[];
};

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { created_at: "desc" },
      include: {
        userRoles: {
          include: { role: true },
        },
        userDepartments: {
          include: { department: true },
        },
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateUserBody;
    const { fullName, email, phone, clerkUserId, roleNames = [], departmentNames = [] } = body;

    if (!fullName || !email || !phone) {
      return NextResponse.json(
        { error: "fullName, email, and phone are required" },
        { status: 400 },
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName,
          email,
          phone,
          clerkUserId: clerkUserId ?? null,
        },
      });

      if (roleNames.length > 0) {
        const roles = await tx.role.findMany({
          where: { name: { in: roleNames } },
          select: { id: true, name: true },
        });

        if (roles.length !== roleNames.length) {
          const found = new Set(roles.map((r) => r.name));
          const missing = roleNames.filter((name) => !found.has(name));
          throw new Error(`Unknown role(s): ${missing.join(", ")}`);
        }

        await tx.userRole.createMany({
          data: roles.map((role) => ({ userId: user.id, roleId: role.id })),
          skipDuplicates: true,
        });
      }

      if (departmentNames.length > 0) {
        const departments = await tx.department.findMany({
          where: { name: { in: departmentNames } },
          select: { id: true, name: true },
        });

        if (departments.length !== departmentNames.length) {
          const found = new Set(departments.map((d) => d.name));
          const missing = departmentNames.filter((name) => !found.has(name));
          throw new Error(`Unknown department(s): ${missing.join(", ")}`);
        }

        await tx.userDepartment.createMany({
          data: departments.map((department) => ({
            userId: user.id,
            departmentId: department.id,
          })),
          skipDuplicates: true,
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        include: {
          userRoles: { include: { role: true } },
          userDepartments: { include: { department: true } },
        },
      });
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = String(error);
    const status = message.includes("Unknown role(s)") || message.includes("Unknown department(s)")
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
