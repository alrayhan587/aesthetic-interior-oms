import prisma from '@/lib/prisma';
import {
  ActivityType,
  LeadAssignmentDepartment,
  LeadStage,
} from '@/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import {
  logActivity,
  logLeadStageChanged,
  logUserAssigned,
} from '@/lib/activity-log-service';
import { requireDatabaseRoles } from '@/lib/authz';

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

type ScheduleVisitBody = {
  visitTeamUserId?: unknown;
  scheduledAt?: unknown;
  location?: unknown;
  notes?: unknown;
  reason?: unknown;
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

async function validateVisitTeamUser(userId: string) {
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

  if (!visitTeamUser) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: 'Visit team user not found' }, { status: 404 }) };
  }

  const isInVisitDepartment = visitTeamUser.userDepartments.some(
    ({ department }) => department.name === 'VISIT_TEAM'
  );

  if (!isInVisitDepartment) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: 'User is not mapped to VISIT_TEAM department' },
        { status: 400 }
      ),
    };
  }

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
    if (!authResult.ok) {
      return authResult.response;
    }

    const actorUserId = authResult.actorUserId;
    const leadId = await resolveLeadId(context);
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 });
    }

    const body = (await request.json()) as ScheduleVisitBody;
    const visitTeamUserId = toOptionalString(body.visitTeamUserId);
    const notes = toOptionalString(body.notes);
    const reason = toOptionalString(body.reason);
    const scheduledAtRaw = toOptionalString(body.scheduledAt);
    const parsedScheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;
    const explicitLocation = toOptionalString(body.location);

    if (!visitTeamUserId || !scheduledAtRaw || !parsedScheduledAt || Number.isNaN(parsedScheduledAt.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: 'visitTeamUserId and a valid ISO scheduledAt are required',
        },
        { status: 400 }
      );
    }

    const [lead, visitTeamUserResult] = await Promise.all([
      prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, name: true, stage: true, location: true },
      }),
      validateVisitTeamUser(visitTeamUserId),
    ]);

    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    if (!visitTeamUserResult.ok) {
      return visitTeamUserResult.response;
    }

    const locationToUse = explicitLocation ?? lead.location;
    if (!locationToUse) {
      return NextResponse.json(
        {
          success: false,
          error: 'Location is required. Provide location in request or set lead location.',
        },
        { status: 400 }
      );
    }

    const updatedLead = await prisma.$transaction(async (tx) => {
      const leadAfterStageUpdate = await tx.lead.update({
        where: { id: leadId },
        data: {
          stage: LeadStage.VISIT_SCHEDULED,
        },
      });

      const visit = await tx.visit.create({
        data: {
          leadId,
          assignedToId: visitTeamUserId,
          createdById: actorUserId,
          scheduledAt: parsedScheduledAt,
          location: locationToUse,
          notes,
        },
      });

      const existingVisitTeamAssignment = await tx.leadAssignment.findFirst({
        where: {
          leadId,
          department: LeadAssignmentDepartment.VISIT_TEAM,
        },
      });

      if (existingVisitTeamAssignment) {
        await tx.leadAssignment.update({
          where: { id: existingVisitTeamAssignment.id },
          data: {
            userId: visitTeamUserId,
          },
        });
      } else {
        await tx.leadAssignment.create({
          data: {
            leadId,
            userId: visitTeamUserId,
            department: LeadAssignmentDepartment.VISIT_TEAM,
          },
        });
      }

      if (notes) {
        await tx.note.create({
          data: {
            leadId,
            userId: actorUserId,
            content: notes,
          },
        });
      }

      if (lead.stage !== LeadStage.VISIT_SCHEDULED) {
        await logLeadStageChanged(tx, {
          leadId,
          userId: actorUserId,
          from: lead.stage,
          to: LeadStage.VISIT_SCHEDULED,
          reason,
        });
      }

      const reasonPart = reason ? ` Reason: ${reason}` : '';
      await logActivity(tx, {
        leadId,
        userId: actorUserId,
        type: ActivityType.VISIT_SCHEDULED,
        description: `Visit ${visit.id} scheduled at ${parsedScheduledAt.toISOString()} and assigned to ${visitTeamUserResult.visitTeamUser.fullName}.${reasonPart}`,
      });

      await logUserAssigned(tx, {
        leadId,
        userId: actorUserId,
        leadName: `${visitTeamUserResult.visitTeamUser.fullName} assigned to VISIT_TEAM department`,
      });

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
