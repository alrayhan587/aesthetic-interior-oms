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
    const location = toOptionalString(body.location);
    const notes = toOptionalString(body.notes);
    const reason = toOptionalString(body.reason);
    const scheduledAtRaw = toOptionalString(body.scheduledAt);
    const parsedScheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;

    if (!visitTeamUserId || !location || !scheduledAtRaw || !parsedScheduledAt || Number.isNaN(parsedScheduledAt.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: 'visitTeamUserId, location, and a valid ISO scheduledAt are required',
        },
        { status: 400 }
      );
    }

    const [lead, visitTeamUser] = await Promise.all([
      prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, name: true, stage: true },
      }),
      prisma.user.findUnique({
        where: { id: visitTeamUserId },
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
      }),
    ]);

    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    if (!visitTeamUser) {
      return NextResponse.json(
        { success: false, error: 'Visit team user not found' },
        { status: 404 }
      );
    }

    const isInVisitDepartment = visitTeamUser.userDepartments.some(
      ({ department }) => department.name === 'VISIT_TEAM'
    );

    if (!isInVisitDepartment) {
      return NextResponse.json(
        {
          success: false,
          error: 'User is not mapped to VISIT_TEAM department',
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
          location,
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

      if (lead.stage !== LeadStage.VISIT_SCHEDULED) {
        await logLeadStageChanged(tx, {
          leadId,
          userId: actorUserId,
          from: lead.stage,
          to: LeadStage.VISIT_SCHEDULED,
          reason,
        });
      }

      await logActivity(tx, {
        leadId,
        userId: actorUserId,
        type: ActivityType.VISIT_SCHEDULED,
        description: `Visit ${visit.id} scheduled at ${parsedScheduledAt.toISOString()} and assigned to ${visitTeamUser.fullName}`,
      });

      await logUserAssigned(tx, {
        leadId,
        userId: actorUserId,
        leadName: `${visitTeamUser.fullName} assigned to VISIT_TEAM department`,
      });

      return {
        lead: leadAfterStageUpdate,
        visit,
      };
    });

    return NextResponse.json({
      success: true,
      data: updatedLead,
      message: 'Visit scheduled, stage moved, and visit team assigned successfully',
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
      Allow: 'POST, OPTIONS',
    },
  });
}
