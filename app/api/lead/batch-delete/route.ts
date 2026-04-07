import { NextRequest, NextResponse } from 'next/server'
import { requireDatabaseRoles } from '@/lib/authz'
import prisma from '@/lib/prisma'

type BatchDeleteBody = {
  leadIds?: unknown
}

function toLeadIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const leadIds = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
  return Array.from(new Set(leadIds))
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) {
      return authResult.response
    }

    const actorDepartments = new Set(authResult.actor.userDepartments ?? [])
    if (!actorDepartments.has('ADMIN')) {
      return NextResponse.json(
        { success: false, error: 'Only ADMIN users can run batch delete' },
        { status: 403 },
      )
    }

    const body = (await request.json()) as BatchDeleteBody
    const leadIds = toLeadIds(body.leadIds)

    if (leadIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'leadIds is required' },
        { status: 400 },
      )
    }

    if (leadIds.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Maximum 500 leads are allowed per batch delete request' },
        { status: 400 },
      )
    }

    const existingLeads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true },
    })

    const existingLeadIds = new Set(existingLeads.map((lead) => lead.id))
    const missingLeadIds = leadIds.filter((id) => !existingLeadIds.has(id))

    const deleted = await prisma.lead.deleteMany({
      where: { id: { in: Array.from(existingLeadIds) } },
    })

    return NextResponse.json({
      success: true,
      data: {
        requested: leadIds.length,
        deleted: deleted.count,
        missingLeadIds,
      },
      message: `Deleted ${deleted.count} lead(s)`,
    })
  } catch (error) {
    console.error('[POST /api/lead/batch-delete] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to complete batch delete' },
      { status: 500 },
    )
  }
}
