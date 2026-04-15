import prisma from '@/lib/prisma';
import {
  ActivityType,
  LeadAssignmentDepartment,
  LeadSubStatus,
  LeadStage,
  NotificationType,
  ProjectStatus,
} from '@/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import {
  logActivity,
  logLeadStageChanged,
  logUserAssigned,
} from '@/lib/activity-log-service';
import { requireDatabaseRoles } from '@/lib/authz';
import { autoCompletePendingFollowups } from '@/lib/followup-auto-complete';
import { findVisitConflict } from '@/lib/visit-guards';

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

type ScheduleVisitBody = {
  visitTeamUserId?: unknown;
  scheduledAt?: unknown;
  location?: unknown;
  notes?: unknown;
  reason?: unknown;
  projectSqft?: unknown;
  projectStatus?: unknown;
  visitFee?: unknown;
};

async function resolveLeadId(context: RouteContext): Promise<string | null> {
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

async function validateVisitAssignee(userId: string) {
  const visitAssignee = await prisma.user.findUnique({
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

  // console.log('[validateVisitTeamUser] User found:', visitTeamUser);

  if (!visitAssignee) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: 'Visit assignee user not found' }, { status: 404 }) };
  }

  const isAllowedDepartment = visitAssignee.userDepartments.some(
    ({ department }) => department.name === 'VISIT_TEAM' || department.name === 'SR_CRM'
  );

  if (!isAllowedDepartment) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: 'User must be mapped to VISIT_TEAM or SR_CRM department' },
        { status: 400 }
      ),
    };
  }

  return { ok: true as const, visitAssignee };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([]);
    if (!authResult.ok) {
      return authResult.response;
    }

    const leadId = await resolveLeadId(context);
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 });
    }

    const [lead, visitTeamDepartment, srCrmDepartment] = await Promise.all([
      prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, name: true, location: true, stage: true },
      }),
      prisma.department.findUnique({
        where: { name: 'VISIT_TEAM' },
        select: {
          id: true,
          name: true,
          userDepartments: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  phone: true,
                },
              },
            },
            orderBy: {
              user: {
                fullName: 'asc',
              },
            },
          },
        },
      }),
      prisma.department.findUnique({
        where: { name: 'SR_CRM' },
        select: {
          id: true,
          name: true,
          userDepartments: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  phone: true,
                },
              },
            },
            orderBy: {
              user: {
                fullName: 'asc',
              },
            },
          },
        },
      }),
    ]);

    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    const visitMembers = (visitTeamDepartment?.userDepartments ?? []).map((row) => row.user);
    const srMembers = (srCrmDepartment?.userDepartments ?? []).map((row) => row.user);
    const uniqueById = new Map<string, (typeof visitMembers)[number]>();
    for (const member of [...visitMembers, ...srMembers]) {
      if (!uniqueById.has(member.id)) {
        uniqueById.set(member.id, member);
      }
    }
    const members = Array.from(uniqueById.values());

    return NextResponse.json({
      success: true,
      data: {
        lead,
        defaultLocation: lead.location,
        visitTeamMembers: members,
        visitAssigneeMembers: members,
      },
    });
  } catch (error) {
    console.error('[lead/:id/visit-schedule][GET] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch visit schedule metadata' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([]);
    // console.log('[POST] authResult:', JSON.stringify(authResult, null, 2));
    // console.log('[POST] authResult.ok:', authResult.ok);
    if (!authResult.ok) {
      return authResult.response;
    }

    const actorUserId = authResult.actorUserId;
    // console.log('[POST] actorUserId extracted:', actorUserId);
    // console.log('[POST] actorUserId extracted:', actorUserId);
    const leadId = await resolveLeadId(context);
    // console.log('[POST] leadId resolved:', leadId);
    if (!leadId) {
      // console.log('[POST] Invalid leadId');
      return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 });
    }

    const body = (await request.json()) as ScheduleVisitBody;
    // console.log('[POST] Request body received:', JSON.stringify(body, null, 2));
    const visitTeamUserId = toOptionalString(body.visitTeamUserId);
    const notes = toOptionalString(body.notes);
    const reason = toOptionalString(body.reason) ?? 'Visit has been scheduled.';
    const projectSqft = toOptionalNumber(body.projectSqft);
    const visitFee = toOptionalNumber(body.visitFee);
    const projectStatus = toProjectStatus(body.projectStatus);
    const scheduledAtRaw = toOptionalString(body.scheduledAt);
    const parsedScheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;
    const explicitLocation = toOptionalString(body.location);

    if (!visitTeamUserId || !scheduledAtRaw || !parsedScheduledAt || Number.isNaN(parsedScheduledAt.getTime())) {
      // console.log('[POST] Validation failed - missing required fields');
      return NextResponse.json(
        {
          success: false,
          error: 'visitTeamUserId and a valid ISO scheduledAt are required',
        },
        { status: 400 }
      );
    }
    if (hasValue(body.projectSqft) && (projectSqft === null || projectSqft <= 0)) {
      return NextResponse.json(
        { success: false, error: 'projectSqft must be greater than 0' },
        { status: 400 },
      );
    }
    if (hasValue(body.visitFee) && (visitFee === null || visitFee < 0)) {
      return NextResponse.json(
        { success: false, error: 'visitFee must be a non-negative number' },
        { status: 400 },
      );
    }

    if (hasValue(body.projectStatus) && !projectStatus) {
      return NextResponse.json(
        { success: false, error: 'projectStatus must be UNDER_CONSTRUCTION or READY' },
        { status: 400 },
      );
    }

    // console.log('[POST] Querying lead and validating visit team user...');
    const [lead, visitTeamUserResult, latestVisit] = await Promise.all([
      prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, name: true, stage: true, subStatus: true, location: true },
      }),
      validateVisitAssignee(visitTeamUserId),
      prisma.visit.findFirst({
        where: { leadId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          result: { select: { id: true } },
        },
      }),
    ]);

    // console.log('[POST] Lead found:', lead);
    // console.log('[POST] Visit team user validation result:', visitTeamUserResult.ok);

    if (!lead) {
      // console.log('[POST] Lead not found');
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    if (!visitTeamUserResult.ok) {
      // console.log('[POST] Visit team user validation failed');
      return visitTeamUserResult.response;
    }
    const latestVisitHasResult = Boolean(latestVisit?.result?.id);
    const latestVisitBlocksScheduling = Boolean(
      latestVisit &&
      (latestVisit.status === 'SCHEDULED' ||
        latestVisit.status === 'RESCHEDULED' ||
        (latestVisit.status === 'COMPLETED' && !latestVisitHasResult)),
    );
    if (latestVisitBlocksScheduling) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot schedule a new visit until the latest visit result is submitted.',
        },
        { status: 409 },
      );
    }

    const locationToUse = explicitLocation ?? lead.location;
    // console.log('[POST] Location to use:', locationToUse);
    if (!locationToUse) {
      // console.log('[POST] No location provided or set on lead');
      return NextResponse.json(
        {
          success: false,
          error: 'Location is required. Provide location in request or set lead location.',
        },
        { status: 400 }
      );
    }

    // console.log('[POST] Starting transaction to create visit...');
    const updatedLead = await prisma.$transaction(async (tx) => {
      const conflict = await findVisitConflict(tx, {
        assignedToId: visitTeamUserId,
        scheduledAt: parsedScheduledAt,
      });
      if (conflict) {
        throw new Error('VISIT_CONFLICT');
      }

      // console.log('[POST] Transaction started');
      const leadAfterStageUpdate = await tx.lead.update({
        where: { id: leadId },
        data: {
          stage: LeadStage.VISIT_PHASE,
          subStatus: LeadSubStatus.VISIT_SCHEDULED,
          location: locationToUse,
        },
      });
      // console.log('[POST] Lead stage updated to VISIT_PHASE/VISIT_SCHEDULED');

      const visit = await tx.visit.create({
        data: {
          leadId,
          assignedToId: visitTeamUserId,
          createdById: actorUserId,
          scheduledAt: parsedScheduledAt,
          visitFee: visitFee ?? 0,
          projectSqft,
          projectStatus,
          location: locationToUse,
          notes,
        },
      });
      // console.log('[POST] Visit created:', visit.id);

      await tx.notification.createMany({
        data: [
          {
            userId: visitTeamUserId,
            leadId,
            visitId: visit.id,
            type: NotificationType.VISIT_ASSIGNED,
            title: 'New visit assigned',
            message: `You have been assigned a new visit for ${lead.name}.`,
            scheduledFor: parsedScheduledAt,
          },
        ],
        skipDuplicates: true,
      });

      const adminUsers = await tx.user.findMany({
        where: {
          isActive: true,
          userDepartments: {
            some: {
              department: {
                name: 'ADMIN',
              },
            },
          },
        },
        select: { id: true },
      });

      if (adminUsers.length > 0) {
        await tx.notification.createMany({
          data: adminUsers.map((admin) => ({
            userId: admin.id,
            leadId,
            visitId: visit.id,
            type: NotificationType.VISIT_SCHEDULED_ADMIN,
            title: 'Visit scheduled',
            message: `Lead: ${lead.name} visit scheduled at ${parsedScheduledAt.toISOString()} and assigned to ${visitTeamUserResult.visitAssignee.fullName}.`,
            scheduledFor: parsedScheduledAt,
          })),
        });
      }

      const existingVisitTeamAssignment = await tx.leadAssignment.findFirst({
        where: {
          leadId,
          department: LeadAssignmentDepartment.VISIT_TEAM,
        },
      });

      if (existingVisitTeamAssignment) {
        // console.log('[POST] Updating existing visit team assignment');
        await tx.leadAssignment.update({
          where: { id: existingVisitTeamAssignment.id },
          data: {
            userId: visitTeamUserId,
          },
        });
      } else {
        // console.log('[POST] Creating new visit team assignment');
        await tx.leadAssignment.create({
          data: {
            leadId,
            userId: visitTeamUserId,
            department: LeadAssignmentDepartment.VISIT_TEAM,
          },
        });
      }

      if (notes) {
        // console.log('[POST] Creating note');
        await tx.note.create({
          data: {
            leadId,
            userId: actorUserId,
            content: notes,
          },
        });
      }

      if (lead.stage !== LeadStage.VISIT_PHASE || lead.subStatus !== LeadSubStatus.VISIT_SCHEDULED) {
        // console.log('[POST] Logging lead stage change');
        await logLeadStageChanged(tx, {
          leadId,
          userId: actorUserId,
          from: lead.stage,
          to: LeadStage.VISIT_PHASE,
          reason,
        });
      }

      const reasonPart = ` Reason: ${reason}`;
      // console.log('[POST] Logging visit scheduled activity');
      await logActivity(tx, {
        leadId,
        userId: actorUserId,
        type: ActivityType.VISIT_SCHEDULED,
        description: `Visit ${visit.id} scheduled at ${parsedScheduledAt.toISOString()} and assigned to ${visitTeamUserResult.visitAssignee.fullName}.${reasonPart}`,
      });

      // console.log('[POST] Logging user assigned activity');
      await logUserAssigned(tx, {
        leadId,
        userId: actorUserId,
        leadName: `${visitTeamUserResult.visitAssignee.fullName} assigned as visit lead`,
      });

      await autoCompletePendingFollowups(tx, {
        leadId,
        userId: actorUserId,
        action: 'visit scheduled',
      });

      // console.log('[POST] Transaction completed successfully');
      return {
        lead: leadAfterStageUpdate,
        visit,
      };
    });

    return NextResponse.json({
      success: true,
      data: updatedLead,
      message: 'Visit scheduled, stage moved, visit team assigned, note and activity created successfully',
    });
  } catch (error) {
    console.error('[lead/:id/visit-schedule][POST] Error:', error);
    console.error('[lead/:id/visit-schedule][POST] Error type:', error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error) {
      if (error.message === 'VISIT_CONFLICT') {
        return NextResponse.json(
          { success: false, error: 'Selected visit team member already has a nearby scheduled visit' },
          { status: 409 },
        );
      }
      console.error('[lead/:id/visit-schedule][POST] Stack trace:', error.stack);
    }
    return NextResponse.json(
      { success: false, error: 'Failed to schedule visit' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'GET, POST, OPTIONS',
    },
  });
}
