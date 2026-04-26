import { NextRequest, NextResponse } from 'next/server'
import { ActivityType, LeadAssignmentDepartment, LeadStage, LeadSubStatus } from '@/generated/prisma/client'
import prisma from '@/lib/prisma'
import { requireDatabaseRoles } from '@/lib/authz'
import { buildScopedLeadWhere } from '@/lib/lead-access'
import { canManagePrimaryLeadFlow, isSrOrAdmin } from '@/lib/lead-workflow-auth'
import { logActivity, logLeadStageChanged, logLeadSubStatusChanged } from '@/lib/activity-log-service'

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

type CompleteFirstMeetingBody = {
  note?: unknown
  quotationMemberId?: unknown
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

    const actorDepartments = authResult.actor.userDepartments ?? []
    if (!isSrOrAdmin(actorDepartments)) {
      return NextResponse.json(
        { success: false, error: 'Only SR CRM or Admin can complete first meeting' },
        { status: 403 },
      )
    }

    const { id: leadId } = await context.params
    if (!leadId || typeof leadId !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as CompleteFirstMeetingBody
    const note = toOptionalString(body.note)
    const quotationMemberId = toOptionalString(body.quotationMemberId)

    const scopedWhere = buildScopedLeadWhere({
      leadId,
      actorUserId: authResult.actorUserId,
      actorDepartments,
    })

    const lead = await prisma.lead.findFirst({
      where: scopedWhere,
      select: { id: true, name: true, stage: true, subStatus: true, primaryOwnerUserId: true },
    })

    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    if (
      !canManagePrimaryLeadFlow({
        actorUserId: authResult.actorUserId,
        actorDepartments,
        lead: { primaryOwnerUserId: lead.primaryOwnerUserId },
      })
    ) {
      return NextResponse.json(
        { success: false, error: 'Only primary owner, Senior CRM, or admin can complete first meeting' },
        { status: 403 },
      )
    }

    if (!(lead.stage === LeadStage.DISCOVERY && lead.subStatus === LeadSubStatus.FIRST_MEETING_SET)) {
      return NextResponse.json(
        {
          success: false,
          error: 'First meeting can be completed only when lead is in Discovery / First Meeting Set',
        },
        { status: 409 },
      )
    }

    if (quotationMemberId) {
      const quotationUser = await prisma.user.findFirst({
        where: {
          id: quotationMemberId,
          isActive: true,
          userDepartments: {
            some: {
              department: {
                name: LeadAssignmentDepartment.QUOTATION,
              },
            },
          },
        },
        select: { id: true },
      })
      if (!quotationUser) {
        return NextResponse.json(
          { success: false, error: 'Selected quotation member is invalid or inactive' },
          { status: 400 },
        )
      }
    }

    const now = new Date()
    const nextStage = quotationMemberId ? LeadStage.QUOTATION_PHASE : LeadStage.DISCOVERY
    const nextSubStatus = quotationMemberId ? LeadSubStatus.QUOTATION_ASSIGNED : LeadSubStatus.PROPOSAL_SENT
    const stageReason = quotationMemberId
      ? 'First meeting completed and quotation member assigned.'
      : 'First meeting completed without quotation assignment.'
    const mergedNote = note ?? stageReason

    await prisma.$transaction(async (tx) => {
      if (quotationMemberId) {
        const existingQuotationAssignment = await tx.leadAssignment.findFirst({
          where: {
            leadId,
            department: LeadAssignmentDepartment.QUOTATION,
          },
          select: { id: true },
        })

        if (existingQuotationAssignment) {
          await tx.leadAssignment.update({
            where: { id: existingQuotationAssignment.id },
            data: { userId: quotationMemberId },
          })
        } else {
          await tx.leadAssignment.create({
            data: {
              leadId,
              department: LeadAssignmentDepartment.QUOTATION,
              userId: quotationMemberId,
            },
          })
        }
      }

      await tx.lead.update({
        where: { id: leadId },
        data: {
          stage: nextStage,
          subStatus: nextSubStatus,
        },
      })

      if (lead.stage !== nextStage) {
        await logLeadStageChanged(tx, {
          leadId,
          userId: authResult.actorUserId,
          from: lead.stage,
          to: nextStage,
          reason: stageReason,
        })
      }

      await logLeadSubStatusChanged(tx, {
        leadId,
        userId: authResult.actorUserId,
        from: lead.subStatus,
        to: nextSubStatus,
        reason: stageReason,
      })

      await logActivity(tx, {
        leadId,
        userId: authResult.actorUserId,
        type: ActivityType.NOTE,
        description: `First meeting completed.${mergedNote ? ` Note: ${mergedNote}` : ''}`,
      })
    })

    return NextResponse.json({
      success: true,
      data: {
        leadId: lead.id,
        stage: nextStage,
        subStatus: nextSubStatus,
      },
      message: quotationMemberId
        ? 'First meeting completed and sent to quotation with assignment'
        : 'First meeting completed and marked as proposal sent',
    })
  } catch (error) {
    console.error('[lead/:id/meetings/complete][POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to complete first meeting' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'POST, OPTIONS' },
  })
}
