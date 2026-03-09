import prisma from '@/lib/prisma';
import { LeadSubStatus } from '@/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { isSubStatusAllowedForStage } from '@/lib/lead-stage';
import { logLeadSubStatusChanged } from '@/lib/activity-log-service';

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

type UpdateLeadSubStatusBody = {
  subStatus?: unknown;
  userId?: unknown;
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

function toLeadSubStatus(value: unknown): LeadSubStatus | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toUpperCase();
  return Object.values(LeadSubStatus).includes(normalized as LeadSubStatus)
    ? (normalized as LeadSubStatus)
    : null;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const leadId = await resolveLeadId(context);
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 });
    }

    const body = (await request.json()) as UpdateLeadSubStatusBody;
    const nextSubStatus = toLeadSubStatus(body.subStatus);
    const userId = toOptionalString(body.userId);
    const reason = toOptionalString(body.reason);

    if (nextSubStatus === undefined) {
      return NextResponse.json(
        { success: false, error: 'subStatus is required (use null to clear)' },
        { status: 400 }
      );
    }

    const existingLead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, stage: true, subStatus: true },
    });

    if (!existingLead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    if (!isSubStatusAllowedForStage(existingLead.stage, nextSubStatus)) {
      return NextResponse.json(
        { success: false, error: 'Invalid subStatus for current stage' },
        { status: 400 }
      );
    }

    const updatedLead = await prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id: leadId },
        data: { subStatus: nextSubStatus },
      });

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
      message: 'Lead subStatus updated successfully',
    });
  } catch (error) {
    console.error('[lead/:id/substatus][PATCH] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update lead subStatus' },
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
