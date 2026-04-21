import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { LeadAssignmentDepartment, LeadStage, LeadSubStatus } from '@/generated/prisma/client'
import { requireDatabaseRoles } from '@/lib/authz'

export async function GET() {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const actorDepartments = new Set(authResult.actor.userDepartments ?? [])
    const canView =
      actorDepartments.has('ADMIN') ||
      actorDepartments.has('SR_CRM') ||
      actorDepartments.has('QUOTATION') ||
      actorDepartments.has('QUOTATION_TEAM')

    if (!canView) {
      return NextResponse.json(
        { success: false, error: 'Only quotation team, senior CRM, or admin can access assigned tasks' },
        { status: 403 },
      )
    }

    const leads = await prisma.lead.findMany({
      where: {
        assignments: {
          some: {
            department: LeadAssignmentDepartment.QUOTATION,
            userId: authResult.actorUserId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        location: true,
        stage: true,
        subStatus: true,
        updated_at: true,
        budget: true,
        assignments: {
          where: { department: LeadAssignmentDepartment.QUOTATION },
          select: {
            user: {
              select: { id: true, fullName: true, email: true },
            },
          },
          take: 1,
        },
        meetingEvents: {
          where: { type: 'FIRST_MEETING' },
          select: {
            id: true,
            title: true,
            notes: true,
            startsAt: true,
          },
          orderBy: { startsAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updated_at: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        location: lead.location,
        stage: lead.stage,
        subStatus: lead.subStatus,
        updatedAt: lead.updated_at,
        budget: lead.budget,
        quotationAssignee: lead.assignments[0]?.user ?? null,
        latestFirstMeeting: lead.meetingEvents[0] ?? null,
        canStart:
          lead.stage === LeadStage.QUOTATION_PHASE && lead.subStatus === LeadSubStatus.QUOTATION_ASSIGNED,
        canSubmit:
          lead.stage === LeadStage.QUOTATION_PHASE && lead.subStatus === LeadSubStatus.QUOTATION_WORKING,
      })),
    })
  } catch (error) {
    console.error('[quotation/assigned-tasks][GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load assigned quotation tasks' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'GET, OPTIONS' },
  })
}
