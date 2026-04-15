import prisma from '@/lib/prisma';
import { LeadSubStatus } from '@/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { isSubStatusAllowedForStage } from '@/lib/lead-stage';
import { logLeadSubStatusChanged } from '@/lib/activity-log-service';
import { requireDatabaseRoles } from '@/lib/authz';
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
    const authResult = await requireDatabaseRoles([]);
    if (!authResult.ok) {
      return authResult.response;
    }

    const leadId = await resolveLeadId(context);
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 });
    }

    const body = (await request.json()) as UpdateLeadSubStatusBody;
    const nextSubStatus = toLeadSubStatus(body.subStatus);
    const userId = authResult.actorUserId ?? toOptionalString(body.userId);
    const reason = toOptionalString(body.reason);
    const actorDepartments = authResult.actor.userDepartments ?? [];

    if (nextSubStatus === undefined) {
      return NextResponse.json(
        { success: false, error: 'subStatus is required (use null to clear)' },
        { status: 400 }
      );
    }

    const scopedWhere = buildScopedLeadWhere({
      leadId,
      actorUserId: authResult.actorUserId,
      actorDepartments,
    });
    const existingLead = await prisma.lead.findFirst({
      where: scopedWhere,
      select: { id: true, stage: true, subStatus: true, primaryOwnerUserId: true },
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
    if (!canManagePaymentStatus({ actorDepartments, nextSubStatus })) {
      return NextResponse.json(
        { success: false, error: 'Only Senior CRM, Accounts, or Admin can update payment statuses' },
        { status: 403 },
      );
    }
    if (
      !canManagePrimaryLeadFlow({
        actorUserId: authResult.actorUserId,
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

      if (requiresSrCrmAssignment(existingLead.stage)) {
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
        actorUserId: authResult.actorUserId,
      });
      await createSrCadReviewTodosForCadStart({
        tx,
        leadId,
        fromStage: existingLead.stage,
        fromSubStatus: existingLead.subStatus,
        toStage: existingLead.stage,
        toSubStatus: nextSubStatus,
        triggeredByUserId: authResult.actorUserId,
      });

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
