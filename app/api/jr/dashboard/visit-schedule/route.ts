import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 20

function toPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const actor = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    })

    if (!actor) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 },
      )
    }

    const { searchParams } = new URL(request.url)
    const parsedLimit = toPositiveInt(searchParams.get('limit'), DEFAULT_LIMIT)
    const limit = Math.min(parsedLimit, MAX_LIMIT)
    const offset = Math.max(0, toPositiveInt(searchParams.get('offset'), 0))

    const visits = await prisma.visit.findMany({
      where: { createdById: actor.id },
      orderBy: { scheduledAt: 'desc' },
      skip: offset,
      take: limit + 1,
      include: {
        lead: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, fullName: true } },
      },
    })
    const hasMore = visits.length > limit
    const sliced = hasMore ? visits.slice(0, limit) : visits

    return NextResponse.json({
      success: true,
      data: sliced.map((visit) => ({
        id: visit.id,
        leadId: visit.leadId,
        leadName: visit.lead?.name ?? 'Unknown',
        location: visit.location,
        visitFee: visit.visitFee,
        projectSqft: visit.projectSqft,
        projectStatus: visit.projectStatus,
        scheduledAt: visit.scheduledAt,
        status: visit.status,
        assignedTeamMember: visit.assignedTo?.fullName ?? 'Unassigned',
      })),
      pagination: {
        offset,
        limit,
        hasMore,
        nextOffset: hasMore ? offset + limit : null,
      },
    })
  } catch (error) {
    console.error('[GET /api/jr/dashboard/visit-schedule] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load visit schedule' },
      { status: 500 },
    )
  }
}
