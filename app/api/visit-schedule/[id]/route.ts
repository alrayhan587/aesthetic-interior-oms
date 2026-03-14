import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ActivityType, LeadAssignmentDepartment, VisitStatus } from '@/generated/prisma/client';
import { requireDatabaseRoles } from '@/lib/authz';
import { logActivity } from '@/lib/activity-log-service';

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

type UpdateVisitBody = {
  visitTeamUserId?: unknown;
  scheduledAt?: unknown;
  location?: unknown;
  notes?: unknown;
  status?: unknown;
  reason?: unknown;
};

async function resolveVisitId(context: RouteContext): Promise<string | null> {
  const resolvedParams = await context.params;
  const id = resolvedParams?.id;

  if (typeof id !== 'string') return null;

  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toVisitStatus(value: string | null): VisitStatus | null {
  if (!value) return null;
  return Object.values(VisitStatus).includes(value as VisitStatus)
    ? (value as VisitStatus)
    : null;
}

async function ensureVisitTeamUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
  });

  if (!user) {
    return { ok: false as const, error: 'Visit team user not found', status: 404 };
  }

  const isVisitMember = user.userDepartments.some((ud) => ud.department.name === 'VISIT_TEAM');
  if (!isVisitMember) {
    return { ok: false as const, error: 'User is not mapped to VISIT_TEAM department', status: 400 };
  }

  return { ok: true as const, user };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([]);
    if (!authResult.ok) return authResult.response;

    const visitId = await resolveVisitId(context);
    if (!visitId) {
      return NextResponse.json({ success: false, error: 'Invalid visit schedule id' }, { status: 400 });
    }

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        lead: { select: { id: true, name: true, phone: true, location: true } },
        assignedTo: { select: { id: true, fullName: true, email: true, phone: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    if (!visit) {
      return NextResponse.json({ success: false, error: 'Visit schedule not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: visit });
  } catch (error) {
    console.error('[visit-schedule/:id][GET] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch visit schedule' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([]);
    if (!authResult.ok) return authResult.response;

    const actorUserId = authResult.actorUserId;
    const visitId = await resolveVisitId(context);
    if (!visitId) {
      return NextResponse.json({ success: false, error: 'Invalid visit schedule id' }, { status: 400 });
    }

    const body = (await request.json()) as UpdateVisitBody;

    const visitTeamUserId = toOptionalString(body.visitTeamUserId);
    const location = toOptionalString(body.location);
    const notes = toOptionalString(body.notes);
    const reason = toOptionalString(body.reason);
    const scheduledAtRaw = toOptionalString(body.scheduledAt);
    const parsedScheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;
    const statusInput = toVisitStatus(toOptionalString(body.status));

    if (scheduledAtRaw && (!parsedScheduledAt || Number.isNaN(parsedScheduledAt.getTime()))) {
      return NextResponse.json({ success: false, error: 'scheduledAt must be a valid ISO date-time' }, { status: 400 });
    }

    if (body.status !== undefined && !statusInput) {
      return NextResponse.json({ success: false, error: 'Invalid visit status' }, { status: 400 });
    }

    if (visitTeamUserId) {
      const check = await ensureVisitTeamUser(visitTeamUserId);
      if (!check.ok) {
        return NextResponse.json({ success: false, error: check.error }, { status: check.status });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.visit.findUnique({ where: { id: visitId } });
      if (!existing) {
        throw new Error('NOT_FOUND');
      }

      const visit = await tx.visit.update({
        where: { id: visitId },
        data: {
          ...(visitTeamUserId ? { assignedToId: visitTeamUserId } : {}),
          ...(location ? { location } : {}),
          ...(notes !== null ? { notes } : {}),
          ...(parsedScheduledAt ? { scheduledAt: parsedScheduledAt } : {}),
          ...(statusInput ? { status: statusInput } : {}),
        },
      });

      if (visitTeamUserId) {
        const existingVisitTeamAssignment = await tx.leadAssignment.findFirst({
          where: {
            leadId: visit.leadId,
            department: LeadAssignmentDepartment.VISIT_TEAM,
          },
        });

        if (existingVisitTeamAssignment) {
          await tx.leadAssignment.update({
            where: { id: existingVisitTeamAssignment.id },
            data: { userId: visitTeamUserId },
          });
        } else {
          await tx.leadAssignment.create({
            data: {
              leadId: visit.leadId,
              userId: visitTeamUserId,
              department: LeadAssignmentDepartment.VISIT_TEAM,
            },
          });
        }
      }

      if (notes) {
        await tx.note.create({
          data: {
            leadId: visit.leadId,
            userId: actorUserId,
            content: notes,
          },
        });
      }

      const reasonPart = reason ? ` Reason: ${reason}` : '';
      await logActivity(tx, {
        leadId: visit.leadId,
        userId: actorUserId,
        type: ActivityType.NOTE,
        description: `Visit ${visit.id} updated.${reasonPart}`,
      });

      return visit;
    });

    return NextResponse.json({ success: true, data: updated, message: 'Visit schedule updated successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Visit schedule not found' }, { status: 404 });
    }

    console.error('[visit-schedule/:id][PATCH] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update visit schedule' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([]);
    if (!authResult.ok) return authResult.response;

    const actorUserId = authResult.actorUserId;
    const visitId = await resolveVisitId(context);
    if (!visitId) {
      return NextResponse.json({ success: false, error: 'Invalid visit schedule id' }, { status: 400 });
    }

    const reason = toOptionalString(request.nextUrl.searchParams.get('reason'));

    await prisma.$transaction(async (tx) => {
      const existing = await tx.visit.findUnique({ where: { id: visitId } });
      if (!existing) {
        throw new Error('NOT_FOUND');
      }

      await tx.visit.delete({ where: { id: visitId } });

      const reasonPart = reason ? ` Reason: ${reason}` : '';
      await logActivity(tx, {
        leadId: existing.leadId,
        userId: actorUserId,
        type: ActivityType.NOTE,
        description: `Visit ${existing.id} deleted.${reasonPart}`,
      });
    });

    return NextResponse.json({ success: true, message: 'Visit schedule deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Visit schedule not found' }, { status: 404 });
    }

    console.error('[visit-schedule/:id][DELETE] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete visit schedule' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'GET, PATCH, DELETE, OPTIONS',
    },
  });
}
