import { Prisma } from '@/generated/prisma/client'
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

function parseIsoDate(value: string | null): Date | null {
  const normalized = toOptionalString(value)
  if (!normalized) return null
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const actorUserId = authResult.actorUserId
    const actorDepartments = new Set(authResult.actor.userDepartments ?? [])
    const isAdmin = actorDepartments.has('ADMIN')
    const isSr = actorDepartments.has('SR_CRM')

    if (!isAdmin && !isSr) {
      return NextResponse.json({ success: false, error: 'Only SR CRM or Admin can access meetings' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const myLeadsOnly = toBooleanParam(searchParams.get('myLeadsOnly'), true)
    const from = parseIsoDate(searchParams.get('from'))
    const to = parseIsoDate(searchParams.get('to'))

    if (searchParams.get('from') && !from) {
      return NextResponse.json({ success: false, error: 'Invalid from date' }, { status: 400 })
    }
    if (searchParams.get('to') && !to) {
      return NextResponse.json({ success: false, error: 'Invalid to date' }, { status: 400 })
    }
    if (from && to && from.getTime() > to.getTime()) {
      return NextResponse.json({ success: false, error: 'from must be before or equal to to' }, { status: 400 })
    }

    const whereParts: Prisma.Sql[] = []
    if (from) {
      whereParts.push(Prisma.sql`m."startsAt" >= ${from}`)
    }
    if (to) {
      whereParts.push(Prisma.sql`m."startsAt" <= ${to}`)
    }

    const scopeMyLeadsOnly = !isAdmin || myLeadsOnly
    if (scopeMyLeadsOnly) {
      whereParts.push(Prisma.sql`
        EXISTS (
          SELECT 1
          FROM "LeadAssignment" la
          WHERE la."leadId" = l."id"
            AND la."department" = 'SR_CRM'
            AND la."userId" = ${actorUserId}
        )
      `)
    } else {
      whereParts.push(Prisma.sql`
        EXISTS (
          SELECT 1
          FROM "LeadAssignment" la
          WHERE la."leadId" = l."id"
            AND la."department" = 'SR_CRM'
        )
      `)
    }

    const whereClause =
      whereParts.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(whereParts, ' AND ')}`
        : Prisma.sql``

    type MeetingRow = {
      id: string
      type: string
      title: string
      startsAt: Date
      endsAt: Date | null
      notes: string | null
      leadId: string
      leadName: string
      leadStage: string
      leadSubStatus: string | null
      createdById: string
      createdByFullName: string
      createdByEmail: string
      createdAt: Date
      updatedAt: Date
    }

    const rows = await prisma.$queryRaw<MeetingRow[]>(Prisma.sql`
      SELECT
        m."id",
        m."type",
        m."title",
        m."startsAt",
        m."endsAt",
        m."notes",
        m."createdAt",
        m."updatedAt",
        l."id" AS "leadId",
        l."name" AS "leadName",
        l."stage"::text AS "leadStage",
        l."subStatus"::text AS "leadSubStatus",
        u."id" AS "createdById",
        u."fullName" AS "createdByFullName",
        u."email" AS "createdByEmail"
      FROM "LeadMeetingEvent" m
      INNER JOIN "Lead" l ON l."id" = m."leadId"
      INNER JOIN "User" u ON u."id" = m."createdById"
      ${whereClause}
      ORDER BY m."startsAt" ASC
    `)

    const meetings = rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      notes: row.notes,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lead: {
        id: row.leadId,
        name: row.leadName,
        stage: row.leadStage,
        subStatus: row.leadSubStatus,
        assignments: [],
      },
      createdBy: {
        id: row.createdById,
        fullName: row.createdByFullName,
        email: row.createdByEmail,
      },
    }))

    return NextResponse.json({
      success: true,
      data: meetings,
    })
  } catch (error) {
    console.error('[lead/meetings][GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch meetings' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'GET, OPTIONS' },
  })
}
