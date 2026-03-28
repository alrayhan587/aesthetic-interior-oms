import prisma from '@/lib/prisma';
import {
  ActivityType,
  LeadAssignmentDepartment,
  LeadStage,
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

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

type ScheduleVisitBody = {
  visitTeamUserId?: unknown;
  scheduledAt?: unknown;
  location?: unknown;
  notes?: unknown;
  reason?: unknown;
  projectSqft?: unknown;
  projectStatus?: unknown;
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

async function validateVisitTeamUser(userId: string) {
  // console.log('[validateVisitTeamUser] Validating user:', userId);
  const visitTeamUser = await prisma.user.findUnique({
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

  if (!visitTeamUser) {
    // console.log('[validateVisitTeamUser] User not found');
    return { ok: false as const, response: NextResponse.json({ success: false, error: 'Visit team user not found' }, { status: 404 }) };
  }

  const isInVisitDepartment = visitTeamUser.userDepartments.some(
    ({ department }) => department.name === 'VISIT_TEAM'
  );

  // console.log('[validateVisitTeamUser] User departments:', visitTeamUser.userDepartments);
  // console.log('[validateVisitTeamUser] Is in VISIT_TEAM department:', isInVisitDepartment);

  if (!isInVisitDepartment) {
    // console.log('[validateVisitTeamUser] User not in VISIT_TEAM department');
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: 'User is not mapped to VISIT_TEAM department' },
        { status: 400 }
      ),
    };
  }

  // console.log('[validateVisitTeamUser] Validation passed');
  return { ok: true as const, visitTeamUser };
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

    const [lead, visitTeamDepartment] = await Promise.all([
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
    ]);

    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    const members = (visitTeamDepartment?.userDepartments ?? []).map((row) => row.user);

    return NextResponse.json({
      success: true,
      data: {
        lead,
        defaultLocation: lead.location,
        visitTeamMembers: members,
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
    const reason = toOptionalString(body.reason);
    const projectSqft = toOptionalNumber(body.projectSqft);
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

    if (!projectSqft || projectSqft <= 0) {
      return NextResponse.json(
        { success: false, error: 'projectSqft is required and must be greater than 0' },
        { status: 400 },
      );
    }

    if (!projectStatus) {
      return NextResponse.json(
        { success: false, error: 'projectStatus is required and must be UNDER_CONSTRUCTION or READY' },
        { status: 400 },
      );
    }

    // console.log('[POST] Querying lead and validating visit team user...');
    const [lead, visitTeamUserResult] = await Promise.all([
      prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, name: true, stage: true, location: true },
      }),
      validateVisitTeamUser(visitTeamUserId),
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
      // console.log('[POST] Transaction started');
      const leadAfterStageUpdate = await tx.lead.update({
        where: { id: leadId },
        data: {
          stage: LeadStage.VISIT_SCHEDULED,
          location: locationToUse,
        },
      });
      // console.log('[POST] Lead stage updated to VISIT_SCHEDULED');

      const visit = await tx.visit.create({
        data: {
          leadId,
          assignedToId: visitTeamUserId,
          createdById: actorUserId,
          scheduledAt: parsedScheduledAt,
          projectSqft,
          projectStatus,
          location: locationToUse,
          notes,
        },
      });
      // console.log('[POST] Visit created:', visit.id);

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

      if (lead.stage !== LeadStage.VISIT_SCHEDULED) {
        // console.log('[POST] Logging lead stage change');
        await logLeadStageChanged(tx, {
          leadId,
          userId: actorUserId,
          from: lead.stage,
          to: LeadStage.VISIT_SCHEDULED,
          reason,
        });
      }

      const reasonPart = reason ? ` Reason: ${reason}` : '';
      // console.log('[POST] Logging visit scheduled activity');
      await logActivity(tx, {
        leadId,
        userId: actorUserId,
        type: ActivityType.VISIT_SCHEDULED,
        description: `Visit ${visit.id} scheduled at ${parsedScheduledAt.toISOString()} and assigned to ${visitTeamUserResult.visitTeamUser.fullName}.${reasonPart}`,
      });

      // console.log('[POST] Logging user assigned activity');
      await logUserAssigned(tx, {
        leadId,
        userId: actorUserId,
        leadName: `${visitTeamUserResult.visitTeamUser.fullName} assigned to VISIT_TEAM department`,
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
