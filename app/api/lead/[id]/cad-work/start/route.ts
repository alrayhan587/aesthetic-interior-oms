import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  LeadAssignmentDepartment,
  LeadStage,
  LeadSubStatus,
} from '@/generated/prisma/client'
import { requireDatabaseRoles } from '@/lib/authz'
import { logLeadStageChanged, logLeadSubStatusChanged } from '@/lib/activity-log-service'
import { ensurePhaseTaskForSubStatus } from '@/lib/lead-phase-task'

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

async function resolveLeadId(context: RouteContext): Promise<string | null> {
  const resolvedParams = await context.params
  const id = resolvedParams?.id
  if (typeof id !== 'string') return null
  const trimmed = id.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) {
      return authResult.response
    }

    const leadId = await resolveLeadId(context)
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as { reason?: unknown }
    const reason = toOptionalString(body.reason) ?? 'JR Architect started CAD work.'

    const actorDepartments = new Set(authResult.actor.userDepartments ?? [])
    const isAdmin = actorDepartments.has('ADMIN')
    const isSeniorCrm = actorDepartments.has('SR_CRM')
    const isJrArchitect = actorDepartments.has('JR_ARCHITECT')

    if (!isAdmin && !isSeniorCrm && !isJrArchitect) {
      return NextResponse.json(
        { success: false, error: 'Only JR Architect, Senior CRM, or Admin can start CAD work' },
        { status: 403 },
      )
    }

    const updatedLead = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({
        where: {
          id: leadId,
          ...(isAdmin || isSeniorCrm
            ? {}
            : {
                assignments: {
                  some: {
                    userId: authResult.actorUserId,
                    department: LeadAssignmentDepartment.JR_ARCHITECT,
                  },
                },
              }),
        },
        select: {
          id: true,
          stage: true,
          subStatus: true,
        },
      })

      if (!lead) {
        throw new Error('LEAD_NOT_FOUND')
      }

      if (lead.stage === LeadStage.CAD_PHASE && lead.subStatus === LeadSubStatus.CAD_WORKING) {
        return lead
      }

      const updated = await tx.lead.update({
        where: { id: lead.id },
        data: {
          stage: LeadStage.CAD_PHASE,
          subStatus: LeadSubStatus.CAD_WORKING,
        },
      })

      if (lead.stage !== LeadStage.CAD_PHASE) {
        await logLeadStageChanged(tx, {
          leadId: lead.id,
          userId: authResult.actorUserId,
          from: lead.stage,
          to: LeadStage.CAD_PHASE,
          reason,
        })
      }

      if (lead.subStatus !== LeadSubStatus.CAD_WORKING) {
        await logLeadSubStatusChanged(tx, {
          leadId: lead.id,
          userId: authResult.actorUserId,
          from: lead.subStatus,
          to: LeadSubStatus.CAD_WORKING,
          reason,
        })
      }

      await ensurePhaseTaskForSubStatus({
        tx,
        leadId: lead.id,
        subStatus: LeadSubStatus.CAD_WORKING,
        actorUserId: authResult.actorUserId,
      })

      return updated
    })

    return NextResponse.json({
      success: true,
      data: updatedLead,
      message: 'CAD work started successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'LEAD_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Lead not found or not assigned to you' }, { status: 404 })
    }

    console.error('[lead/:id/cad-work/start][POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to start CAD work' }, { status: 500 })
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

