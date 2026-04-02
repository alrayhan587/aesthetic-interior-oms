import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ActivityType, LeadAssignmentDepartment, LeadStage, ProjectStatus, VisitStatus } from '@/generated/prisma/client';
import { requireDatabaseRoles } from '@/lib/authz';
import { logActivity, logLeadStageChanged } from '@/lib/activity-log-service';
import { autoCompletePendingFollowups } from '@/lib/followup-auto-complete';

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

type UpdateVisitBody = {
  visitTeamUserId?: unknown;
  scheduledAt?: unknown;
  location?: unknown;
  notes?: unknown;
  status?: unknown;
  reason?: unknown;
  projectSqft?: unknown;
  projectStatus?: unknown;
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

function toOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toProjectStatus(value: unknown): ProjectStatus | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return Object.values(ProjectStatus).includes(normalized as ProjectStatus)
    ? (normalized as ProjectStatus)
    : null;
}

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
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

function leadStageFromVisitStatus(status: VisitStatus): LeadStage | null {
  if (status === VisitStatus.SCHEDULED) return LeadStage.VISIT_SCHEDULED;
  if (status === VisitStatus.COMPLETED) return LeadStage.VISIT_COMPLETED;
  if (status === VisitStatus.RESCHEDULED) return LeadStage.VISIT_RESCHEDULED;
  if (status === VisitStatus.CANCELLED) return LeadStage.VISIT_CANCELLED;
  return null;
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
        supportAssignments: {
          include: {
            supportUser: { select: { id: true, fullName: true, email: true } },
            result: { select: { id: true, completedAt: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        supportResults: {
          include: {
            supportUser: { select: { id: true, fullName: true, email: true } },
            files: { orderBy: { createdAt: 'desc' } },
          },
          orderBy: { completedAt: 'desc' },
        },
        result: {
          include: {
            files: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
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
    const projectSqft = toOptionalNumber(body.projectSqft);
    const projectStatus = toProjectStatus(body.projectStatus);

    if (scheduledAtRaw && (!parsedScheduledAt || Number.isNaN(parsedScheduledAt.getTime()))) {
      return NextResponse.json({ success: false, error: 'scheduledAt must be a valid ISO date-time' }, { status: 400 });
    }

    if (body.status !== undefined && !statusInput) {
      return NextResponse.json({ success: false, error: 'Invalid visit status' }, { status: 400 });
    }
    if (statusInput === VisitStatus.RESCHEDULED && !parsedScheduledAt) {
      return NextResponse.json(
        { success: false, error: 'scheduledAt is required when rescheduling a visit' },
        { status: 400 },
      );
    }
    if (hasValue(body.projectSqft) && (projectSqft === null || projectSqft <= 0)) {
      return NextResponse.json({ success: false, error: 'projectSqft must be greater than 0' }, { status: 400 });
    }
    if (hasValue(body.projectStatus) && !projectStatus) {
      return NextResponse.json(
        { success: false, error: 'projectStatus must be UNDER_CONSTRUCTION or READY' },
        { status: 400 },
      );
    }

    if (visitTeamUserId) {
      const check = await ensureVisitTeamUser(visitTeamUserId);
      if (!check.ok) {
        return NextResponse.json({ success: false, error: check.error }, { status: check.status });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const actor = await tx.user.findUnique({
        where: { id: actorUserId },
        select: {
          userDepartments: {
            select: {
              department: { select: { name: true } },
            },
          },
        },
      });
      const departmentNames = new Set((actor?.userDepartments ?? []).map((row) => row.department.name));
      const isAdmin = departmentNames.has('ADMIN');
      const isJuniorCrm = departmentNames.has('JR_CRM');
      const isVisitTeam = departmentNames.has('VISIT_TEAM');
      if (!isAdmin && !isJuniorCrm && !isVisitTeam) {
        throw new Error('FORBIDDEN');
      }

      const existing = await tx.visit.findUnique({
        where: { id: visitId },
        include: {
          lead: {
            select: {
              stage: true,
            },
          },
        },
      });
      if (!existing) {
        throw new Error('NOT_FOUND');
      }

      if (isVisitTeam && !isAdmin && existing.assignedToId !== actorUserId) {
        throw new Error('NOT_ASSIGNED');
      }

      const visit = await tx.visit.update({
        where: { id: visitId },
        data: {
          ...(visitTeamUserId ? { assignedToId: visitTeamUserId } : {}),
          ...(location ? { location } : {}),
          ...(notes !== null ? { notes } : {}),
          ...(parsedScheduledAt ? { scheduledAt: parsedScheduledAt } : {}),
          ...(statusInput ? { status: statusInput } : {}),
          ...(body.projectSqft !== undefined ? { projectSqft } : {}),
          ...(body.projectStatus !== undefined ? { projectStatus } : {}),
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

      const nextLeadStage = statusInput ? leadStageFromVisitStatus(statusInput) : null;
      if (nextLeadStage && existing.lead.stage !== nextLeadStage) {
        await tx.lead.update({
          where: { id: visit.leadId },
          data: {
            stage: nextLeadStage,
            subStatus: null,
          },
        });
        await logLeadStageChanged(tx, {
          leadId: visit.leadId,
          userId: actorUserId,
          from: existing.lead.stage,
          to: nextLeadStage,
          reason: `Visit ${visit.id} status updated to ${statusInput}`,
        });
      }

      if (statusInput === VisitStatus.RESCHEDULED && parsedScheduledAt) {
        await tx.visit.update({
          where: { id: visit.id },
          data: {
            status: VisitStatus.RESCHEDULED,
            scheduledAt: parsedScheduledAt,
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

      await autoCompletePendingFollowups(tx, {
        leadId: visit.leadId,
        userId: actorUserId,
        action: 'visit update',
      });

      return visit;
    });

    return NextResponse.json({ success: true, data: updated, message: 'Visit schedule updated successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Visit schedule not found' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ success: false, error: 'Not authorized to update visit schedule' }, { status: 403 });
    }
    if (error instanceof Error && error.message === 'NOT_ASSIGNED') {
      return NextResponse.json({ success: false, error: 'You can only update visits assigned to you' }, { status: 403 });
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

      await autoCompletePendingFollowups(tx, {
        leadId: existing.leadId,
        userId: actorUserId,
        action: 'visit update',
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
