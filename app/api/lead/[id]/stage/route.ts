import prisma from '@/lib/prisma';
import { FollowUpStatus, LeadStage, LeadSubStatus } from '@/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { isSubStatusAllowedForStage } from '@/lib/lead-stage';
import { logLeadStageChanged, logLeadSubStatusChanged } from '@/lib/activity-log-service';
import { requireDatabaseRoles } from '@/lib/authz';

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

type UpdateLeadStageBody = {
  stage?: unknown;
  subStatus?: unknown;
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

function toLeadStage(value: unknown): LeadStage | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return Object.values(LeadStage).includes(normalized as LeadStage)
    ? (normalized as LeadStage)
    : null;
}

function toLeadSubStatus(value: unknown): LeadSubStatus | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toUpperCase();
  return Object.values(LeadSubStatus).includes(normalized as LeadSubStatus)
    ? (normalized as LeadSubStatus)
    : null;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    console.log('🔵 [lead/:id/stage][PATCH] - Request received');
    
    // Get authenticated user ID from auth context
    const authResult = await requireDatabaseRoles([]);
    console.log('✅ [lead/:id/stage][PATCH] - Auth passed');
    if (!authResult.ok) {
      return authResult.response;
    }
    const userId = authResult.actorUserId;
    console.log('🔐 [lead/:id/stage][PATCH] - Auth verified for user:', userId);
    
    const leadId = await resolveLeadId(context);
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 });
    }
    console.log('📝 [lead/:id/stage][PATCH] - Lead ID:', leadId);

    const body = (await request.json()) as UpdateLeadStageBody;
    const nextStage = toLeadStage(body.stage);
    const requestedSubStatus = toLeadSubStatus(body.subStatus);
    const reason = toOptionalString(body.reason);
    console.log('📋 [lead/:id/stage][PATCH] - Extracted fields. Stage:', nextStage, 'SubStatus:', requestedSubStatus);

    if (!nextStage) {
      return NextResponse.json({ success: false, error: 'Valid stage is required' }, { status: 400 });
    }

    const existingLead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, stage: true, subStatus: true },
    });

    if (!existingLead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    const nextSubStatus =
      requestedSubStatus !== undefined
        ? requestedSubStatus
        : isSubStatusAllowedForStage(nextStage, existingLead.subStatus)
          ? existingLead.subStatus
          : null;

    if (!isSubStatusAllowedForStage(nextStage, nextSubStatus)) {
      return NextResponse.json(
        { success: false, error: 'Invalid subStatus for selected stage' },
        { status: 400 }
      );
    }

    const isSubStatusChanging = existingLead.subStatus !== nextSubStatus;
    if (
      isSubStatusChanging &&
      (nextSubStatus === LeadSubStatus.WARM_LEAD ||
        nextSubStatus === LeadSubStatus.FUTURE_CLIENT)
    ) {
      const now = new Date();

      if (nextSubStatus === LeadSubStatus.WARM_LEAD) {
        const upcoming = await prisma.followUp.findFirst({
          where: {
            leadId,
            status: FollowUpStatus.PENDING,
            followupDate: { gte: now },
          },
          select: { id: true },
        });

        if (!upcoming) {
          return NextResponse.json(
            { success: false, error: 'Warm lead requires a scheduled follow-up' },
            { status: 400 }
          );
        }
      }

      if (nextSubStatus === LeadSubStatus.FUTURE_CLIENT) {
        const minDate = addDays(now, 30);
        const earliestPending = await prisma.followUp.findFirst({
          where: {
            leadId,
            status: FollowUpStatus.PENDING,
            followupDate: { gte: now },
          },
          orderBy: { followupDate: 'asc' },
          select: { followupDate: true },
        });

        if (!earliestPending) {
          return NextResponse.json(
            {
              success: false,
              error: 'Future client requires a follow-up at least 30 days from today',
            },
            { status: 400 }
          );
        }

        if (earliestPending.followupDate < minDate) {
          return NextResponse.json(
            {
              success: false,
              error: 'Future client follow-up must be scheduled at least 30 days from today',
            },
            { status: 400 }
          );
        }
      }
    }

    const updatedLead = await prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id: leadId },
        data: {
          stage: nextStage,
          subStatus: nextSubStatus,
        },
      });

      if (existingLead.stage !== nextStage) {
        await logLeadStageChanged(tx, {
          leadId,
          userId,
          from: existingLead.stage,
          to: nextStage,
          reason,
        });
      }

      if (existingLead.subStatus !== nextSubStatus) {
        await logLeadSubStatusChanged(tx, {
          leadId,
          userId,
          from: existingLead.subStatus,
          to: nextSubStatus,
          reason,
        });
      }

      return updated;
    });

    return NextResponse.json({
      success: true,
      data: updatedLead,
      message: 'Lead stage updated successfully',
    });
  } catch (error) {
    console.error('[lead/:id/stage][PATCH] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update lead stage' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'PATCH, OPTIONS',
    },
  });
}
