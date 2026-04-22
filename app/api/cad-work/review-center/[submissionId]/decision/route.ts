import { NextRequest, NextResponse } from 'next/server'
import {
  ActivityType,
  LeadPhaseReviewDecision,
  LeadPhaseTaskStatus,
  LeadPhaseType,
  LeadStage,
  LeadSubStatus,
  NotificationType,
} from '@/generated/prisma/client'
import prisma from '@/lib/prisma'
import { requireDatabaseRoles } from '@/lib/authz'
import { logLeadSubStatusChanged } from '@/lib/activity-log-service'

type RouteContext = { params: { submissionId: string } | Promise<{ submissionId: string }> }

type ReviewDecision = 'APPROVE' | 'CORRECTION'

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function resolveSubmissionId(context: RouteContext): Promise<string | null> {
  const resolvedParams = await context.params
  const submissionId = resolvedParams?.submissionId
  if (typeof submissionId !== 'string') return null
  const trimmed = submissionId.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toDecision(value: unknown): ReviewDecision | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  if (normalized === 'APPROVE' || normalized === 'CORRECTION') return normalized
  return null
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const submissionId = await resolveSubmissionId(context)
    if (!submissionId) {
      return NextResponse.json({ success: false, error: 'Invalid submission id' }, { status: 400 })
    }

    const actorDepartments = new Set(authResult.actor.userDepartments ?? [])
    const isAdmin = actorDepartments.has('ADMIN')
    const isSeniorCrm = actorDepartments.has('SR_CRM')
    if (!isAdmin && !isSeniorCrm) {
      return NextResponse.json(
        { success: false, error: 'Only Senior CRM or Admin can review CAD submissions' },
        { status: 403 },
      )
    }

    const body = (await request.json().catch(() => ({}))) as { decision?: unknown; summary?: unknown }
    const decision = toDecision(body.decision)
    const summary = toOptionalString(body.summary)

    if (!decision) {
      return NextResponse.json({ success: false, error: 'Valid decision is required' }, { status: 400 })
    }
    if (decision === 'CORRECTION' && !summary) {
      return NextResponse.json(
        { success: false, error: 'Correction summary is required' },
        { status: 400 },
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const submission = await tx.cadWorkSubmission.findFirst({
        where: {
          id: submissionId,
          lead: {
            stage: LeadStage.CAD_PHASE,
            subStatus: LeadSubStatus.CAD_COMPLETED,
            ...(isAdmin
              ? {}
              : {
                  assignments: {
                    some: {
                      userId: authResult.actorUserId,
                      department: 'SR_CRM',
                    },
                  },
                }),
          },
        },
        select: {
          id: true,
          submittedAt: true,
          leadId: true,
          lead: {
            select: {
              id: true,
              name: true,
              stage: true,
              subStatus: true,
              assignments: {
                where: {
                  department: { in: ['JR_ARCHITECT', 'ADMIN'] },
                },
                select: {
                  userId: true,
                  department: true,
                },
              },
            },
          },
        },
      })

      if (!submission) {
        throw new Error('SUBMISSION_NOT_FOUND')
      }

      const latestSubmission = await tx.cadWorkSubmission.findFirst({
        where: { leadId: submission.leadId },
        select: { id: true },
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      })

      if (!latestSubmission || latestSubmission.id !== submission.id) {
        throw new Error('STALE_SUBMISSION')
      }

      const nextSubStatus =
        decision === 'APPROVE' ? LeadSubStatus.CAD_APPROVED : LeadSubStatus.CAD_ASSIGNED
      const reason =
        decision === 'APPROVE'
          ? summary ?? 'Senior CRM approved CAD submission from Review Center.'
          : summary ?? 'Senior CRM sent CAD files back for correction.'

      const now = new Date()
      await tx.lead.update({
        where: { id: submission.leadId },
        data: {
          stage: LeadStage.CAD_PHASE,
          subStatus: nextSubStatus,
        },
      })

      await logLeadSubStatusChanged(tx, {
        leadId: submission.leadId,
        userId: authResult.actorUserId,
        from: submission.lead.subStatus,
        to: nextSubStatus,
        reason,
      })

      const cadTask = await tx.leadPhaseTask.findFirst({
        where: {
          leadId: submission.leadId,
          phaseType: LeadPhaseType.CAD,
          status: { in: [LeadPhaseTaskStatus.OPEN, LeadPhaseTaskStatus.IN_REVIEW] },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          currentReviewRound: true,
        },
      })

      if (cadTask) {
        const nextRound = cadTask.currentReviewRound + 1
        await tx.leadPhaseTask.update({
          where: { id: cadTask.id },
          data: {
            status: decision === 'APPROVE' ? LeadPhaseTaskStatus.COMPLETED : LeadPhaseTaskStatus.OPEN,
            completedAt: decision === 'APPROVE' ? now : null,
            lastSrActionAt: now,
            currentReviewRound: nextRound,
          },
        })

        await tx.leadPhaseReview.create({
          data: {
            taskId: cadTask.id,
            roundNo: nextRound,
            reviewedById: authResult.actorUserId,
            decision:
              decision === 'APPROVE'
                ? LeadPhaseReviewDecision.APPROVED
                : LeadPhaseReviewDecision.REWORK,
            comment: summary,
          },
        })
      }

      await tx.activityLog.create({
        data: {
          leadId: submission.leadId,
          userId: authResult.actorUserId,
          type: ActivityType.PHASE_REVIEW_ROUND,
          description:
            decision === 'APPROVE'
              ? `CAD submission approved in Review Center.${summary ? ` Note: ${summary}` : ''}`
              : `CAD correction requested in Review Center. Summary: ${summary}`,
        },
      })

      const notificationTargets = Array.from(
        new Set(
          submission.lead.assignments
            .filter((assignment) => assignment.userId !== authResult.actorUserId)
            .map((assignment) => assignment.userId),
        ),
      )

      if (notificationTargets.length > 0) {
        await tx.notification.createMany({
          data: notificationTargets.map((userId) => ({
            userId,
            leadId: submission.leadId,
            type: NotificationType.LEAD_ASSIGNED_TO_YOU,
            title: decision === 'APPROVE' ? 'CAD submission approved' : 'CAD correction required',
            message:
              decision === 'APPROVE'
                ? `${submission.lead.name} CAD submission was approved by Senior CRM.`
                : `${submission.lead.name} needs CAD correction. Summary: ${summary}`,
            scheduledFor: now,
          })),
        })
      }

      return {
        submissionId: submission.id,
        leadId: submission.leadId,
        stage: LeadStage.CAD_PHASE,
        subStatus: nextSubStatus,
      }
    })

    return NextResponse.json({
      success: true,
      data: result,
      message:
        decision === 'APPROVE'
          ? 'CAD submission approved and moved to CAD Approved'
          : 'CAD correction sent back and moved to CAD Assigned',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'SUBMISSION_NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: 'Submission not found, already reviewed, or not in your scope' },
        { status: 404 },
      )
    }
    if (error instanceof Error && error.message === 'STALE_SUBMISSION') {
      return NextResponse.json(
        {
          success: false,
          error: 'This is not the latest CAD submission for this lead. Please review the newest one.',
        },
        { status: 409 },
      )
    }

    console.error('[cad-work/review-center/:submissionId/decision][POST] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process CAD review decision' },
      { status: 500 },
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'POST, OPTIONS',
    },
  })
}
