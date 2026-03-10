import prisma from '@/lib/prisma';
import { ActivityType, FollowUpStatus, LeadSubStatus } from '@/generated/prisma/client';
import { isSubStatusAllowedForStage } from '@/lib/lead-stage';
import { logActivity, logLeadSubStatusChanged } from '@/lib/activity-log-service';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = { params: { leadId: string } | Promise<{ leadId: string }> };

async function resolveLeadId(context: RouteContext): Promise<string | null> {
  const resolvedParams = await context.params;
  const leadId = resolvedParams?.leadId?.trim() || null;
  return leadId && leadId.length > 0 ? leadId : null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toDate(value: unknown): Date | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toLeadSubStatus(value: unknown): LeadSubStatus | undefined | 'invalid' {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return 'invalid';
  const normalized = value.trim().toUpperCase();
  return Object.values(LeadSubStatus).includes(normalized as LeadSubStatus)
    ? (normalized as LeadSubStatus)
    : 'invalid';
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

// GET /api/followup/[leadId] - Get all follow-ups for a specific lead
export async function GET(_request: NextRequest, context: RouteContext) {
  const leadId = await resolveLeadId(context);
  if (!leadId) {
    return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 });
  }

  try {
    // Verify that the lead exists
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Fetch all follow-ups for this lead
    const followUps = await prisma.followUp.findMany({
      where: { leadId },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            location: true,
          },
        },
        assignedTo: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { followupDate: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: followUps,
      count: followUps.length,
    });
  } catch (error: any) {
    console.error('Error fetching follow-ups for lead:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch follow-ups', message: error.message },
      { status: 500 }
    );
  }
}

// POST /api/followup/[leadId] - Create a new follow-up for a specific lead
export async function POST(request: NextRequest, context: RouteContext) {
  const leadId = await resolveLeadId(context);
  if (!leadId) {
    return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const assignedToId = toNonEmptyString(body.assignedToId);
    const followupDate = toDate(body.followupDate);
    const notes = typeof body.notes === 'string' ? body.notes : undefined;
    const userId = toNonEmptyString(body.userId);
    const requestedSubStatus = toLeadSubStatus(body.subStatus);

    // Validation
    if (!assignedToId || !followupDate) {
      return NextResponse.json(
        { success: false, error: 'Assigned user and follow-up date are required' },
        { status: 400 }
      );
    }

    if (requestedSubStatus === 'invalid') {
      return NextResponse.json(
        { success: false, error: 'Invalid subStatus value' },
        { status: 400 }
      );
    }

    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, stage: true, subStatus: true },
    });

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    if (
      requestedSubStatus !== undefined &&
      !isSubStatusAllowedForStage(lead.stage, requestedSubStatus)
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid subStatus for selected stage' },
        { status: 400 }
      );
    }

    const now = new Date();
    if (requestedSubStatus === LeadSubStatus.FUTURE_CLIENT) {
      const minDate = addDays(now, 30);
      if (followupDate < minDate) {
        return NextResponse.json(
          {
            success: false,
            error: 'Future client follow-up must be scheduled at least 30 days from today',
          },
          { status: 400 }
        );
      }

      const earliestPending = await prisma.followUp.findFirst({
        where: {
          leadId,
          status: FollowUpStatus.PENDING,
          followupDate: { gte: now },
        },
        orderBy: { followupDate: 'asc' },
        select: { followupDate: true },
      });

      if (earliestPending && earliestPending.followupDate < minDate) {
        return NextResponse.json(
          {
            success: false,
            error: 'Cannot set future client while a follow-up exists within the next 30 days',
          },
          { status: 400 }
        );
      }
    }

    // Check if assigned user exists
    const user = await prisma.user.findUnique({
      where: { id: assignedToId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Assigned user not found' },
        { status: 404 }
      );
    }

    // Validation: Check if last follow-up is PENDING
    // Can only create new follow-up if last one is DONE, LATELY_DONE, or no follow-ups exist
    const lastFollowUp = await prisma.followUp.findFirst({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });

    if (lastFollowUp && lastFollowUp.status === FollowUpStatus.PENDING) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot create a new follow-up while the last follow-up is still pending. Please close or mark it as done first.',
        },
        { status: 409 }
      );
    }

    // Create follow-up with transaction to log activity
    const followUp = await prisma.$transaction(async (tx) => {
      const newFollowUp = await tx.followUp.create({
        data: {
          leadId,
          assignedToId,
          followupDate,
          notes,
        },
        include: {
          lead: {
            select: { id: true, name: true, email: true },
          },
          assignedTo: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });

      if (requestedSubStatus !== undefined && requestedSubStatus !== lead.subStatus) {
        await tx.lead.update({
          where: { id: leadId },
          data: { subStatus: requestedSubStatus },
        });

        await logLeadSubStatusChanged(tx, {
          leadId,
          userId,
          from: lead.subStatus,
          to: requestedSubStatus,
        });
      }

      await logActivity(tx, {
        leadId,
        userId,
        type: ActivityType.FOLLOWUP_SET,
        description: `Follow-up scheduled for ${followupDate.toLocaleDateString()}`,
      });

      return newFollowUp;
    });

    return NextResponse.json(
      { success: true, data: followUp, message: 'Follow-up created successfully' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating follow-up:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create follow-up', message: error.message },
      { status: 500 }
    );
  }
}
