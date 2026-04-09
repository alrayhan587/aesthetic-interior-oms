import { ActivityType, LeadStage, LeadSubStatus } from '@/generated/prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireDatabaseRoles } from '@/lib/authz'
import { buildScopedLeadWhere } from '@/lib/lead-access'
import { canManagePrimaryLeadFlow, isSrOrAdmin } from '@/lib/lead-workflow-auth'
import { ensureDepartmentAssignment, ensureSeniorCrmAssignment } from '@/lib/lead-handoff'
import { logActivity, logLeadStageChanged, logLeadSubStatusChanged } from '@/lib/activity-log-service'

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

type SendToVisualAccountsBody = {
  reason?: unknown
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const actorUserId = authResult.actorUserId
    const actorDepartments = authResult.actor.userDepartments ?? []

    if (!isSrOrAdmin(actorDepartments)) {
      return NextResponse.json(
        { success: false, error: 'Only SR CRM or Admin can send lead to 3D and Accounts' },
        { status: 403 },
      )
    }

    const { id: leadId } = await context.params
    if (!leadId || typeof leadId !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as SendToVisualAccountsBody
    const reason = toOptionalString(body.reason) ?? 'Budget confirmed and sent to 3D + Accounts.'

    const scopedWhere = buildScopedLeadWhere({
      leadId,
      actorUserId,
      actorDepartments,
    })

    const existingLead = await prisma.lead.findFirst({
      where: scopedWhere,
      select: {
        id: true,
        stage: true,
        subStatus: true,
        primaryOwnerUserId: true,
      },
    })

    if (!existingLead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    if (
      !canManagePrimaryLeadFlow({
        actorUserId,
        actorDepartments,
        lead: { primaryOwnerUserId: existingLead.primaryOwnerUserId },
      })
    ) {
      return NextResponse.json(
        { success: false, error: 'Only primary owner or admin can send lead to 3D and Accounts' },
        { status: 403 },
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      await ensureSeniorCrmAssignment({
        tx,
        leadId,
        preferredUserId: actorUserId,
        actorUserId,
      })

      await ensureDepartmentAssignment({
        tx,
        leadId,
        department: 'VISUALIZER_3D',
        actorUserId,
      })

      await ensureDepartmentAssignment({
        tx,
        leadId,
        department: 'ACCOUNTS',
        actorUserId,
      })

      const lead = await tx.lead.update({
        where: { id: leadId },
        data: {
          stage: LeadStage.VISUALIZATION_PHASE,
          subStatus: LeadSubStatus.VISUAL_ASSIGNED,
        },
      })

      if (existingLead.stage !== LeadStage.VISUALIZATION_PHASE) {
        await logLeadStageChanged(tx, {
          leadId,
          userId: actorUserId,
          from: existingLead.stage,
          to: LeadStage.VISUALIZATION_PHASE,
          reason,
        })
      }

      if (existingLead.subStatus !== LeadSubStatus.VISUAL_ASSIGNED) {
        await logLeadSubStatusChanged(tx, {
          leadId,
          userId: actorUserId,
          from: existingLead.subStatus,
          to: LeadSubStatus.VISUAL_ASSIGNED,
          reason,
        })
      }

      await logActivity(tx, {
        leadId,
        userId: actorUserId,
        type: ActivityType.HANDOFF_TRIGGERED,
        description: `Combined handoff to VISUALIZER_3D and ACCOUNTS. ${reason}`,
      })

      return lead
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Lead sent to visualization and accounts successfully',
    })
  } catch (error) {
    console.error('[lead/:id/send-to-visual-accounts][POST] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send lead to visualization and accounts' },
      { status: 500 },
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'POST, OPTIONS' },
  })
}
