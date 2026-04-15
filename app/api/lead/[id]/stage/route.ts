import prisma from '@/lib/prisma';
import { LeadStage, LeadSubStatus } from '@/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { isSubStatusAllowedForStage } from '@/lib/lead-stage';
import { logLeadStageChanged, logLeadSubStatusChanged } from '@/lib/activity-log-service';
import { requireDatabaseRoles } from '@/lib/authz';
import { autoCompletePendingFollowups } from '@/lib/followup-auto-complete';
import {
  canManagePaymentStatus,
  ensureDepartmentAssignment,
  ensureSeniorCrmAssignment,
  handoffDepartmentForSubStatus,
  requiresSrCrmAssignment,
} from '@/lib/lead-handoff';
import { buildScopedLeadWhere } from '@/lib/lead-access';
import { canManagePrimaryLeadFlow } from '@/lib/lead-workflow-auth';
import { ensurePhaseTaskForSubStatus } from '@/lib/lead-phase-task';
import { createSrCadReviewTodosForCadStart } from '@/lib/sr-cad-todo';

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') {
    // console.log(...args);
  }
};

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
  if (
    normalized === LeadStage.VISIT_SCHEDULED ||
    normalized === LeadStage.VISIT_RESCHEDULED ||
    normalized === LeadStage.VISIT_COMPLETED ||
    normalized === LeadStage.VISIT_CANCELLED
  ) {
    return LeadStage.VISIT_PHASE;
  }
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

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    debugLog('🔵 [lead/:id/stage][PATCH] - Request received');
    
    // Get authenticated user ID from auth context
    const authResult = await requireDatabaseRoles([]);
    if (!authResult.ok) {
      return authResult.response;
    }
    const userId = authResult.actorUserId;
    const actorDepartments = authResult.actor.userDepartments ?? [];
    debugLog('🔐 [lead/:id/stage][PATCH] - Auth verified for user:', userId);
    
    const leadId = await resolveLeadId(context);
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 });
    }
    debugLog('📝 [lead/:id/stage][PATCH] - Lead ID:', leadId);

    const body = (await request.json()) as UpdateLeadStageBody;
    const nextStage = toLeadStage(body.stage);
    const requestedSubStatus = toLeadSubStatus(body.subStatus);
    const reason = toOptionalString(body.reason);
    debugLog('📋 [lead/:id/stage][PATCH] - Extracted fields. Stage:', nextStage, 'SubStatus:', requestedSubStatus);

    if (!nextStage) {
      return NextResponse.json({ success: false, error: 'Valid stage is required' }, { status: 400 });
    }

    const scopedWhere = buildScopedLeadWhere({
      leadId,
      actorUserId: userId,
      actorDepartments,
    });

    const existingLead = await prisma.lead.findFirst({
      where: scopedWhere,
      select: { id: true, stage: true, subStatus: true, primaryOwnerUserId: true },
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
    if (nextStage === LeadStage.VISIT_PHASE && nextSubStatus === LeadSubStatus.VISIT_COMPLETED) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Visit Completed must be submitted from the visit result flow after support member data is submitted.',
        },
        { status: 409 },
      );
    }
    if (!canManagePaymentStatus({ actorDepartments, nextSubStatus })) {
      return NextResponse.json(
        { success: false, error: 'Only Senior CRM, Accounts, or Admin can update payment statuses' },
        { status: 403 },
      );
    }
    if (
      !canManagePrimaryLeadFlow({
        actorUserId: userId,
        actorDepartments,
        lead: { primaryOwnerUserId: existingLead.primaryOwnerUserId },
      })
    ) {
      return NextResponse.json(
        { success: false, error: 'Only primary owner, Senior CRM, or admin can change lead flow' },
        { status: 403 },
      );
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

      if (requiresSrCrmAssignment(nextStage)) {
        await ensureSeniorCrmAssignment({
          tx,
          leadId,
          actorUserId: userId,
        });
      }

      const autoHandoffDepartment = handoffDepartmentForSubStatus(nextSubStatus);
      if (autoHandoffDepartment) {
        await ensureDepartmentAssignment({
          tx,
          leadId,
          department: autoHandoffDepartment,
          actorUserId: userId,
        });
      }
      await ensurePhaseTaskForSubStatus({
        tx,
        leadId,
        subStatus: nextSubStatus,
        actorUserId: userId,
      });
      await createSrCadReviewTodosForCadStart({
        tx,
        leadId,
        fromStage: existingLead.stage,
        fromSubStatus: existingLead.subStatus,
        toStage: nextStage,
        toSubStatus: nextSubStatus,
        triggeredByUserId: userId,
      });

      await autoCompletePendingFollowups(tx, {
        leadId,
        userId,
        action: 'stage update',
      });

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
