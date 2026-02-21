import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteParams = { params: { id: string } };

type UpdateUserBody = {
  fullName?: string;
  email?: string;
  phone?: string;
  clerkUserId?: string | null;
  roleNames?: string[];
  departmentNames?: string[];
};

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        userRoles: { include: { role: true } },
        userDepartments: { include: { department: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const body = (await req.json()) as UpdateUserBody;
    const { fullName, email, phone, clerkUserId, roleNames, departmentNames } = body;

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: params.id } });
      if (!user) {
        throw new Error("NOT_FOUND");
      }

      await tx.user.update({
        where: { id: params.id },
        data: {
          ...(fullName !== undefined ? { fullName } : {}),
          ...(email !== undefined ? { email } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(clerkUserId !== undefined ? { clerkUserId } : {}),
        },
      });

      if (roleNames !== undefined) {
        const roles = roleNames.length
          ? await tx.role.findMany({
              where: { name: { in: roleNames } },
              select: { id: true, name: true },
            })
          : [];

        if (roles.length !== roleNames.length) {
          const found = new Set(roles.map((r) => r.name));
          const missing = roleNames.filter((name) => !found.has(name));
          throw new Error(`Unknown role(s): ${missing.join(", ")}`);
        }

        await tx.userRole.deleteMany({ where: { userId: params.id } });
        if (roles.length > 0) {
          await tx.userRole.createMany({
            data: roles.map((role) => ({ userId: params.id, roleId: role.id })),
            skipDuplicates: true,
          });
        }
      }

      if (departmentNames !== undefined) {
        const departments = departmentNames.length
          ? await tx.department.findMany({
              where: { name: { in: departmentNames } },
              select: { id: true, name: true },
            })
          : [];

        if (departments.length !== departmentNames.length) {
          const found = new Set(departments.map((d) => d.name));
          const missing = departmentNames.filter((name) => !found.has(name));
          throw new Error(`Unknown department(s): ${missing.join(", ")}`);
        }

        await tx.userDepartment.deleteMany({ where: { userId: params.id } });
        if (departments.length > 0) {
          await tx.userDepartment.createMany({
            data: departments.map((department) => ({
              userId: params.id,
              departmentId: department.id,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.user.findUniqueOrThrow({
        where: { id: params.id },
        include: {
          userRoles: { include: { role: true } },
          userDepartments: { include: { department: true } },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = String(error);
    if (message.includes("NOT_FOUND")) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (message.includes("Unknown role(s)") || message.includes("Unknown department(s)")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
