import { LeadAssignmentDepartment, LeadStage, LeadSubStatus, Prisma } from '@/generated/prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireDatabaseRoles } from '@/lib/authz'

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
    const isAdmin = actorDepartments.has('ADMIN')
    const isSeniorCrm = actorDepartments.has('SR_CRM')
    const isJrArchitect = actorDepartments.has('JR_ARCHITECT')

    if (!isAdmin && !isSeniorCrm && !isJrArchitect) {
      return NextResponse.json(
        { success: false, error: 'Only Admin, Senior CRM, or JR Architect can access this queue' },
        { status: 403 },
      )
    }

    const searchParams = request.nextUrl.searchParams
    const search = toOptionalString(searchParams.get('search'))
    const cadApprovedOnly = toBooleanParam(searchParams.get('cadApprovedOnly'))

    const where: Prisma.LeadWhereInput = {
      stage: LeadStage.CAD_PHASE,
      ...(cadApprovedOnly ? { subStatus: LeadSubStatus.CAD_APPROVED } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { location: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

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
