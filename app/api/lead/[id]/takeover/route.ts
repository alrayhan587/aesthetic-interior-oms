import { ActivityType, LeadPrimaryOwnerDepartment } from '@/generated/prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireDatabaseRoles } from '@/lib/authz'
import { buildScopedLeadWhere } from '@/lib/lead-access'
import { ensureSeniorCrmAssignment } from '@/lib/lead-handoff'
import { isSrOrAdmin } from '@/lib/lead-workflow-auth'
import { logActivity } from '@/lib/activity-log-service'

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
    if (!authResult.ok) return authResult.response

    if (!isSrOrAdmin(authResult.actor.userDepartments ?? [])) {
      return NextResponse.json({ success: false, error: 'Only SR CRM or Admin can perform takeover' }, { status: 403 })
    }

    const leadId = await resolveLeadId(context)
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as { reason?: unknown }
    const reason = toOptionalString(body.reason) ?? 'SR CRM took over as primary owner.'

    const scopedWhere = buildScopedLeadWhere({
      leadId,
      actorUserId: authResult.actorUserId,
      actorDepartments: authResult.actor.userDepartments ?? [],
    })

    const existingLead = await prisma.lead.findFirst({
      where: scopedWhere,
      select: { id: true, primaryOwnerUserId: true, primaryOwnerDepartment: true },
    })
    if (!existingLead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    const updatedLead = await prisma.$transaction(async (tx) => {
      await ensureSeniorCrmAssignment({
        tx,
        leadId,
        preferredUserId: authResult.actorUserId,
        actorUserId: authResult.actorUserId,
      })

      const updated = await tx.lead.update({
        where: { id: leadId },
        data: {
          primaryOwnerDepartment: LeadPrimaryOwnerDepartment.SR_CRM,
          primaryOwnerUserId: authResult.actorUserId,
        },
      })

      await logActivity(tx, {
        leadId,
        userId: authResult.actorUserId,
        type: ActivityType.SR_TAKEOVER,
        description: reason,
      })

      return updated
    })

    return NextResponse.json({
      success: true,
      data: updatedLead,
      message: 'SR takeover completed successfully',
    })
  } catch (error) {
    console.error('[lead/:id/takeover][POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to takeover lead' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'POST, OPTIONS' },
  })
}
