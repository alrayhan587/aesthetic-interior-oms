import {
  LeadAssignmentDepartment,
  LeadMeetingEventType,
  LeadStage,
  LeadSubStatus,
  Prisma,
} from '@/generated/prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireDatabaseRoles } from '@/lib/authz'
import { hasJrArchitectureLeaderRole } from '@/lib/jr-architecture-roles'

function toOptionalString(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toBooleanParam(value: string | null, fallback = false): boolean {
  const normalized = toOptionalString(value)?.toLowerCase()
  if (!normalized) return fallback
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const actorDepartments = new Set(authResult.actor.userDepartments ?? [])
    const actorRoles = authResult.actorRoles ?? []
    const isAdmin = actorDepartments.has('ADMIN')
    const isSeniorCrm = actorDepartments.has('SR_CRM')
    const isJrArchitectLeader =
      actorDepartments.has('JR_ARCHITECT') && hasJrArchitectureLeaderRole(actorRoles)

    if (!isAdmin && !isSeniorCrm && !isJrArchitectLeader) {
      return NextResponse.json(
        { success: false, error: 'Only Admin, Senior CRM, or JR Architect leaders can access this queue' },
        { status: 403 },
      )
    }

    const searchParams = request.nextUrl.searchParams
    const search = toOptionalString(searchParams.get('search'))
    const cadApprovedOnly = toBooleanParam(searchParams.get('cadApprovedOnly'))

    const phaseScope: Prisma.LeadWhereInput = cadApprovedOnly
      ? {
          OR: [
            {
              stage: LeadStage.CAD_PHASE,
              subStatus: LeadSubStatus.CAD_APPROVED,
            },
            {
              stage: LeadStage.DISCOVERY,
              subStatus: LeadSubStatus.FIRST_MEETING_SET,
              cadWorkSubmissions: { some: {} },
            },
          ],
        }
      : {
          stage: LeadStage.CAD_PHASE,
        }

    const searchScope: Prisma.LeadWhereInput | null = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { location: { contains: search, mode: 'insensitive' } },
          ],
        }
      : null

    const where: Prisma.LeadWhereInput = searchScope
      ? {
          AND: [phaseScope, searchScope],
        }
      : phaseScope

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      include: {
        assignments: {
          where: {
            department: {
              in: [LeadAssignmentDepartment.JR_ARCHITECT, LeadAssignmentDepartment.SR_CRM],
            },
          },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
        meetingEvents: {
          where: { type: LeadMeetingEventType.FIRST_MEETING },
          select: {
            id: true,
            title: true,
            startsAt: true,
            notes: true,
          },
          orderBy: { startsAt: 'desc' },
          take: 1,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: leads.map((lead) => {
        const jrArchitectAssignment =
          lead.assignments.find((item) => item.department === LeadAssignmentDepartment.JR_ARCHITECT) ?? null
        const srCrmAssignment =
          lead.assignments.find((item) => item.department === LeadAssignmentDepartment.SR_CRM) ?? null

        return {
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          location: lead.location,
          stage: lead.stage,
          subStatus: lead.subStatus,
          updatedAt: lead.updated_at,
          budget: lead.budget,
          jrArchitectAssignment,
          srCrmAssignment,
          latestFirstMeeting: lead.meetingEvents[0] ?? null,
          canSetMeeting:
            lead.stage === LeadStage.CAD_PHASE && lead.subStatus === LeadSubStatus.CAD_APPROVED,
          canSubmitMeetingData:
            lead.stage === LeadStage.DISCOVERY && lead.subStatus === LeadSubStatus.FIRST_MEETING_SET,
        }
      }),
    })
  } catch (error) {
    console.error('[cad-work/jr-architect-queue][GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch CAD queue' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'GET, OPTIONS',
    },
  })
}
