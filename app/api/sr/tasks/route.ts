import { NextRequest, NextResponse } from 'next/server'
import { requireDatabaseRoles } from '@/lib/authz'
import {
  ensureSrDeadlineAlerts,
  listSrTaskCards,
  parseSrTaskQuery,
} from '@/lib/sr-task-service'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const actorUserId = authResult.actorUserId
    const actorDepartments = new Set(authResult.actor.userDepartments ?? [])
    const isAdmin = actorDepartments.has('ADMIN')
    const isSr = actorDepartments.has('SR_CRM')

    if (!isAdmin && !isSr) {
      return NextResponse.json({ success: false, error: 'Only SR CRM or Admin can access tasks' }, { status: 403 })
    }

    const query = parseSrTaskQuery(request.nextUrl.searchParams)
    if (request.nextUrl.searchParams.get('from') && !query.from) {
      return NextResponse.json({ success: false, error: 'Invalid from date' }, { status: 400 })
    }
    if (request.nextUrl.searchParams.get('to') && !query.to) {
      return NextResponse.json({ success: false, error: 'Invalid to date' }, { status: 400 })
    }
    if (query.from && query.to && query.from.getTime() > query.to.getTime()) {
      return NextResponse.json({ success: false, error: 'from must be before or equal to to' }, { status: 400 })
    }

    await ensureSrDeadlineAlerts()

    const tasks = await listSrTaskCards({
      actorUserId,
      isAdmin,
      myLeadsOnly: query.myLeadsOnly,
      from: query.from,
      to: query.to,
      todayOnly: query.todayOnly,
    })

    return NextResponse.json({
      success: true,
      data: tasks,
    })
  } catch (error) {
    console.error('[sr/tasks][GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch Senior CRM tasks' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'GET, OPTIONS' },
  })
}

