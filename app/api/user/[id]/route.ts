import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireDatabaseRoles } from "@/lib/authz";
import { LeadAssignmentDepartment, NotificationType, Prisma } from "@/generated/prisma/client";
import { VISIT_TEAM_CO_LEADER_ROLE, VISIT_TEAM_LEADER_ROLE } from "@/lib/visit-team-roles";

type RouteParams = { params: Promise<{ id: string }> };

type UpdateUserBody = {
  fullName?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
  clerkUserId?: string | null;
  roleNames?: string[];
  departmentNames?: string[];
};

async function resolveRolesWithAutoCreate(tx: Prisma.TransactionClient, roleNames: string[]) {
  if (roleNames.length === 0) return [];

  let roles = await tx.role.findMany({
    where: { name: { in: roleNames } },
    select: { id: true, name: true },
  });

  if (roles.length === roleNames.length) return roles;

  const found = new Set(roles.map((role) => role.name));
  const missing = roleNames.filter((name) => !found.has(name));
  const autoCreatable = new Set([VISIT_TEAM_LEADER_ROLE, VISIT_TEAM_CO_LEADER_ROLE]);

  const creatableMissing = missing.filter((name) => autoCreatable.has(name));
  const nonCreatableMissing = missing.filter((name) => !autoCreatable.has(name));

  if (nonCreatableMissing.length > 0) {
    throw new Error(`Unknown role(s): ${nonCreatableMissing.join(", ")}`);
  }

  for (const roleName of creatableMissing) {
    await tx.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description:
          roleName === VISIT_TEAM_LEADER_ROLE
            ? "Visit Team leader with schedule queue oversight access"
            : "Visit Team co-leader with schedule queue oversight access",
      },
    });
  }

  roles = await tx.role.findMany({
    where: { name: { in: roleNames } },
    select: { id: true, name: true },
  });

  if (roles.length !== roleNames.length) {
    const refreshedFound = new Set(roles.map((role) => role.name));
    const refreshedMissing = roleNames.filter((name) => !refreshedFound.has(name));
    throw new Error(`Unknown role(s): ${refreshedMissing.join(", ")}`);
  }

  return roles;
}

export async function GET(_req: Request, { params: paramsPromise }: RouteParams) {
  try {
    const { id } = await paramsPromise;
    const authz = await requireDatabaseRoles([]);
    if (!authz.ok) {
      return authz.response;
    }
    const isAdminDepartmentUser = authz.actor.userDepartments.includes("ADMIN");
    if (!isAdminDepartmentUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
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

export async function PATCH(req: Request, { params: paramsPromise }: RouteParams) {
  try {
    const { id } = await paramsPromise;
    const authz = await requireDatabaseRoles([]);
    if (!authz.ok) {
      return authz.response;
    }
    const isAdminDepartmentUser = authz.actor.userDepartments.includes("ADMIN");
    if (!isAdminDepartmentUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as UpdateUserBody;
    const { fullName, email, phone, isActive, clerkUserId, roleNames, departmentNames } = body;
    const actorUserId = authz.actorUserId;

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        include: { userDepartments: { select: { departmentId: true } } },
      });
      if (!user) {
        throw new Error("NOT_FOUND");
      }
      const wasPendingApproval = user.isActive && user.userDepartments.length === 0;

      await tx.user.update({
        where: { id },
        data: {
          ...(fullName !== undefined ? { fullName } : {}),
          ...(email !== undefined ? { email } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(typeof isActive === "boolean" ? { isActive } : {}),
          ...(clerkUserId !== undefined ? { clerkUserId } : {}),
        },
      });

      if (roleNames !== undefined) {
        const roles = await resolveRolesWithAutoCreate(tx, roleNames);

        await tx.userRole.deleteMany({ where: { userId: id } });
        if (roles.length > 0) {
          await tx.userRole.createMany({
            data: roles.map((role) => ({ userId: id, roleId: role.id })),
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

        await tx.userDepartment.deleteMany({ where: { userId: id } });
        if (departments.length > 0) {
          await tx.userDepartment.createMany({
            data: departments.map((department) => ({
              userId: id,
              departmentId: department.id,
            })),
            skipDuplicates: true,
          });
        }
      }

      const refreshed = await tx.user.findUniqueOrThrow({
        where: { id },
        include: {
          userRoles: { include: { role: true } },
          userDepartments: { include: { department: true } },
          approvedBy: { select: { id: true, fullName: true } },
        },
      });

      const isNowApproved =
        refreshed.isActive &&
        refreshed.userDepartments.length > 0;

      if (wasPendingApproval && isNowApproved) {
        await tx.user.update({
          where: { id },
          data: {
            approvedById: actorUserId,
            approvedAt: new Date(),
          },
        });
        await tx.notification.createMany({
          data: [
            {
              userId: id,
              subjectUserId: id,
              type: NotificationType.SIGNUP_APPROVED,
              title: "Account approved",
              message: "Your signup has been approved by admin. You can now access your dashboard.",
            },
          ],
          skipDuplicates: true,
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id },
        include: {
          userRoles: { include: { role: true } },
          userDepartments: { include: { department: true } },
          approvedBy: { select: { id: true, fullName: true } },
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

export async function DELETE(_req: Request, { params: paramsPromise }: RouteParams) {
  try {
    const { id } = await paramsPromise;
    const authz = await requireDatabaseRoles([]);
    if (!authz.ok) {
      return authz.response;
    }
    const isAdminDepartmentUser = authz.actor.userDepartments.includes("ADMIN");
    if (!isAdminDepartmentUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const assignmentsToTransfer = await tx.leadAssignment.findMany({
        where: { userId: id },
        select: { id: true, leadId: true, department: true },
      });

      const assignmentDepartments = Array.from(
        new Set(assignmentsToTransfer.map((row) => row.department)),
      );

      const replacementUsers = assignmentDepartments.length
        ? await tx.user.findMany({
            where: {
              id: { not: id },
              isActive: true,
              userDepartments: {
                some: {
                  department: {
                    name: { in: assignmentDepartments },
                  },
                },
              },
            },
            select: {
              id: true,
              fullName: true,
              userDepartments: {
                select: {
                  department: {
                    select: { name: true },
                  },
                },
              },
            },
            orderBy: { fullName: "asc" },
          })
        : [];

      const candidatesByDepartment = new Map<string, string[]>();
      for (const user of replacementUsers) {
        for (const row of user.userDepartments) {
          const departmentName = row.department.name;
          const existingList = candidatesByDepartment.get(departmentName) ?? [];
          existingList.push(user.id);
          candidatesByDepartment.set(departmentName, existingList);
        }
      }

      const cursorByDepartment = new Map<string, number>();
      const nextCandidateForDepartment = (department: string): string | null => {
        const candidates = candidatesByDepartment.get(department) ?? [];
        if (candidates.length === 0) return null;
        const cursor = cursorByDepartment.get(department) ?? 0;
        const candidate = candidates[cursor % candidates.length];
        cursorByDepartment.set(department, (cursor + 1) % candidates.length);
        return candidate;
      };

      for (const assignment of assignmentsToTransfer) {
        const replacementUserId = nextCandidateForDepartment(assignment.department);
        if (!replacementUserId) {
          await tx.leadAssignment.delete({ where: { id: assignment.id } });
          continue;
        }

        const duplicate = await tx.leadAssignment.findFirst({
          where: {
            leadId: assignment.leadId,
            department: assignment.department,
            userId: replacementUserId,
          },
          select: { id: true },
        });

        if (duplicate) {
          await tx.leadAssignment.delete({ where: { id: assignment.id } });
        } else {
          await tx.leadAssignment.update({
            where: { id: assignment.id },
            data: { userId: replacementUserId },
          });
        }
      }

      const leadsAssignedToUser = await tx.lead.findMany({
        where: { assignedTo: id },
        select: { id: true },
      });

      const leadIds = leadsAssignedToUser.map((row) => row.id);
      const jrAssignmentsByLead = leadIds.length
        ? await tx.leadAssignment.findMany({
            where: {
              leadId: { in: leadIds },
              department: LeadAssignmentDepartment.JR_CRM,
            },
            select: {
              leadId: true,
              userId: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          })
        : [];

      const fallbackJrCandidate = (candidatesByDepartment.get(LeadAssignmentDepartment.JR_CRM) ?? [])[0] ?? null;

      for (const lead of leadsAssignedToUser) {
        const candidateFromLeadAssignment =
          jrAssignmentsByLead.find((row) => row.leadId === lead.id)?.userId ?? null;
        const nextAssignee = candidateFromLeadAssignment ?? fallbackJrCandidate;

        await tx.lead.update({
          where: { id: lead.id },
          data: { assignedTo: nextAssignee },
        });
      }

      await tx.user.delete({ where: { id } });

      return {
        reassignedLeadCount: leadsAssignedToUser.length,
        transferredAssignmentCount: assignmentsToTransfer.length,
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
