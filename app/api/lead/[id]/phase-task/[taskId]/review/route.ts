import {
  ActivityType,
  LeadPhaseReviewDecision,
  LeadPhaseTaskStatus,
} from '@/generated/prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireDatabaseRoles } from '@/lib/authz'
import { buildScopedLeadWhere } from '@/lib/lead-access'
import { canManagePrimaryLeadFlow, isSrOrAdmin } from '@/lib/lead-workflow-auth'
import { logActivity } from '@/lib/activity-log-service'

type RouteContext = {
  params: { id: string; taskId: string } | Promise<{ id: string; taskId: string }>
}

type CreateReviewBody = {
  decision?: unknown
  comment?: unknown
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toReviewDecision(value: unknown): LeadPhaseReviewDecision | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return Object.values(LeadPhaseReviewDecision).includes(normalized as LeadPhaseReviewDecision)
    ? (normalized as LeadPhaseReviewDecision)
    : null
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const actorDepartments = authResult.actor.userDepartments ?? []
    if (!isSrOrAdmin(actorDepartments)) {
      return NextResponse.json({ success: false, error: 'Only SR CRM or Admin can submit phase review' }, { status: 403 })
    }

    const { id: leadId, taskId } = await context.params
    if (!leadId || !taskId) {
      return NextResponse.json({ success: false, error: 'Invalid route params' }, { status: 400 })
    }

    const scopedWhere = buildScopedLeadWhere({
      leadId,
      actorUserId: authResult.actorUserId,
      actorDepartments,
    })

    const lead = await prisma.lead.findFirst({
      where: scopedWhere,
      select: { id: true, primaryOwnerUserId: true },
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
      return NextResponse.json({ success: false, error: 'Only primary owner or admin can review phase tasks' }, { status: 403 })
    }

    const body = (await request.json()) as CreateReviewBody
    const decision = toReviewDecision(body.decision)
    const comment = toOptionalString(body.comment)

    if (!decision) {
      return NextResponse.json({ success: false, error: 'decision must be APPROVED or REWORK' }, { status: 400 })
    }

    const task = await prisma.leadPhaseTask.findFirst({
      where: { id: taskId, leadId },
      select: {
        id: true,
        phaseType: true,
        currentReviewRound: true,
      },
    })

    if (!task) {
      return NextResponse.json({ success: false, error: 'Phase task not found' }, { status: 404 })
    }

    const nextRound = task.currentReviewRound + 1

    const result = await prisma.$transaction(async (tx) => {
      const review = await tx.leadPhaseReview.create({
        data: {
          taskId: task.id,
          roundNo: nextRound,
          reviewedById: authResult.actorUserId,
          decision,
          comment,
        },
        include: {
          reviewedBy: { select: { id: true, fullName: true, email: true } },
        },
      })

      await tx.leadPhaseTask.update({
        where: { id: task.id },
        data: {
          currentReviewRound: nextRound,
          status: decision === LeadPhaseReviewDecision.APPROVED ? LeadPhaseTaskStatus.COMPLETED : LeadPhaseTaskStatus.OPEN,
          completedAt: decision === LeadPhaseReviewDecision.APPROVED ? new Date() : null,
          lastSrActionAt: new Date(),
        },
      })

      await logActivity(tx, {
        leadId,
        userId: authResult.actorUserId,
        type: ActivityType.PHASE_REVIEW_ROUND,
        description: `${task.phaseType} review round ${nextRound}: ${decision}${comment ? ` (${comment})` : ''}.`,
      })

      return review
    })

    return NextResponse.json({ success: true, data: result, message: 'Phase review submitted successfully' })
  } catch (error) {
    console.error('[lead/:id/phase-task/:taskId/review][POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to submit phase review' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'POST, OPTIONS' },
  })
}
