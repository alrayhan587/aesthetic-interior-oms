import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireDatabaseRoles } from '@/lib/authz'

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

type CreateSupportBody = {
  supportUserId?: unknown
}

async function resolveVisitId(context: RouteContext): Promise<string | null> {
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

async function isVisitTeamMember(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      userDepartments: {
        select: {
          department: { select: { name: true } },
        },
      },
    },
  })

  if (!user) return null
  const inVisitTeam = user.userDepartments.some((row) => row.department.name === 'VISIT_TEAM')
  if (!inVisitTeam) return null
  return user
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const visitId = await resolveVisitId(context)
    if (!visitId) {
      return NextResponse.json({ success: false, error: 'Invalid visit schedule id' }, { status: 400 })
    }

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      select: {
        id: true,
        assignedToId: true,
        supportAssignments: {
          include: {
            supportUser: { select: { id: true, fullName: true, email: true } },
            result: { select: { id: true, completedAt: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!visit) {
      return NextResponse.json({ success: false, error: 'Visit schedule not found' }, { status: 404 })
    }

    const members = await prisma.user.findMany({
      where: {
        userDepartments: {
          some: {
            department: { name: 'VISIT_TEAM' },
          },
        },
      },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        assignedLeaderId: visit.assignedToId,
        assignedSupports: visit.supportAssignments,
        availableMembers: members.filter(
          (member) =>
            member.id !== visit.assignedToId &&
            !visit.supportAssignments.some((assignment) => assignment.supportUser.id === member.id),
        ),
      },
    })
  } catch (error) {
    console.error('[visit-schedule/:id/supports][GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch support members' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const visitId = await resolveVisitId(context)
    if (!visitId) {
      return NextResponse.json({ success: false, error: 'Invalid visit schedule id' }, { status: 400 })
    }

    const body = (await request.json()) as CreateSupportBody
    const supportUserId = toOptionalString(body.supportUserId)
    if (!supportUserId) {
      return NextResponse.json({ success: false, error: 'supportUserId is required' }, { status: 400 })
    }

    const created = await prisma.$transaction(async (tx) => {
      const actor = await tx.user.findUnique({
        where: { id: authResult.actorUserId },
        select: {
          userDepartments: { select: { department: { select: { name: true } } } },
        },
      })
      const actorDepartments = new Set((actor?.userDepartments ?? []).map((row) => row.department.name))
      const isAdmin = actorDepartments.has('ADMIN')
      const isJrCrm = actorDepartments.has('JR_CRM')
      const isVisitTeam = actorDepartments.has('VISIT_TEAM')

      if (!isAdmin && !isJrCrm && !isVisitTeam) {
        throw new Error('FORBIDDEN')
      }

      const visit = await tx.visit.findUnique({
        where: { id: visitId },
        select: { id: true, assignedToId: true, status: true },
      })
      if (!visit) throw new Error('NOT_FOUND')

      if (
        isVisitTeam &&
        !isAdmin &&
        !isJrCrm &&
        visit.assignedToId !== authResult.actorUserId
      ) {
        throw new Error('NOT_ASSIGNED_LEADER')
      }

      if (visit.status === 'CANCELLED') {
        throw new Error('VISIT_LOCKED')
      }

      const supportUser = await isVisitTeamMember(supportUserId)
      if (!supportUser) throw new Error('INVALID_SUPPORT_USER')

      if (visit.assignedToId === supportUserId) {
        throw new Error('SUPPORT_CANNOT_BE_LEADER')
      }

      return tx.visitSupportAssignment.create({
        data: {
          visitId: visit.id,
          supportUserId,
          assignedById: authResult.actorUserId,
        },
        include: {
          supportUser: { select: { id: true, fullName: true, email: true } },
        },
      })
    })

    return NextResponse.json({
      success: true,
      data: created,
      message: 'Support member added successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ success: false, error: 'Not authorized to add support members' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Visit schedule not found' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'NOT_ASSIGNED_LEADER') {
      return NextResponse.json({ success: false, error: 'Only assigned visit lead can add support members' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'VISIT_LOCKED') {
      return NextResponse.json({ success: false, error: 'Cannot change support members for a cancelled visit' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'INVALID_SUPPORT_USER') {
      return NextResponse.json({ success: false, error: 'Support user must be from VISIT_TEAM' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'SUPPORT_CANNOT_BE_LEADER') {
      return NextResponse.json({ success: false, error: 'Visit leader cannot be added as support' }, { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ success: false, error: 'This support member is already assigned to the visit' }, { status: 409 })
    }

    console.error('[visit-schedule/:id/supports][POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to add support member' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const visitId = await resolveVisitId(context)
    if (!visitId) {
      return NextResponse.json({ success: false, error: 'Invalid visit schedule id' }, { status: 400 })
    }

    const supportUserId = toOptionalString(request.nextUrl.searchParams.get('supportUserId'))
    if (!supportUserId) {
      return NextResponse.json({ success: false, error: 'supportUserId is required' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      const actor = await tx.user.findUnique({
        where: { id: authResult.actorUserId },
        select: {
          userDepartments: { select: { department: { select: { name: true } } } },
        },
      })
      const actorDepartments = new Set((actor?.userDepartments ?? []).map((row) => row.department.name))
      const isAdmin = actorDepartments.has('ADMIN')
      const isJrCrm = actorDepartments.has('JR_CRM')
      const isVisitTeam = actorDepartments.has('VISIT_TEAM')

      const visit = await tx.visit.findUnique({
        where: { id: visitId },
        select: { id: true, assignedToId: true, status: true },
      })
      if (!visit) throw new Error('NOT_FOUND')

      if (
        !isAdmin &&
        !isJrCrm &&
        (!isVisitTeam || visit.assignedToId !== authResult.actorUserId)
      ) {
        throw new Error('FORBIDDEN')
      }

      if (visit.status === 'CANCELLED') {
        throw new Error('VISIT_LOCKED')
      }

      const existing = await tx.visitSupportAssignment.findUnique({
        where: {
          visitId_supportUserId: {
            visitId: visit.id,
            supportUserId,
          },
        },
      })
      if (!existing) throw new Error('SUPPORT_NOT_FOUND')

      await tx.visitSupportAssignment.delete({
        where: { id: existing.id },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Support member removed successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Visit schedule not found' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ success: false, error: 'Not authorized to remove support members' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'VISIT_LOCKED') {
      return NextResponse.json({ success: false, error: 'Cannot change support members for a cancelled visit' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'SUPPORT_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Support member is not assigned to this visit' }, { status: 404 })
    }

    console.error('[visit-schedule/:id/supports][DELETE] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to remove support member' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'GET, POST, DELETE, OPTIONS',
    },
  })
}
