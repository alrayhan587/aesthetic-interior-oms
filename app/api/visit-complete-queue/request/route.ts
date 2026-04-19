import { NextRequest, NextResponse } from 'next/server'
import { requireDatabaseRoles } from '@/lib/authz'
import { createVisitCompleteRequest } from '@/lib/visit-complete-queue'

type RequestBody = {
  leadId?: unknown
  note?: unknown
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const body = (await request.json()) as RequestBody
    const leadId = toOptionalString(body.leadId)
    const note = toOptionalString(body.note)

    if (!leadId) {
      return NextResponse.json({ success: false, error: 'leadId is required' }, { status: 400 })
    }

    const result = await createVisitCompleteRequest({
      actorUserId: authResult.actorUserId,
      actorDepartments: authResult.actor.userDepartments ?? [],
      actorRoles: authResult.actorRoles ?? [],
      leadId,
      note,
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: result.created
        ? 'Request submitted successfully'
        : 'You already have a pending request for this lead',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json(
        { success: false, error: 'Only JR Architect can submit queue requests' },
        { status: 403 },
      )
    }
    if (error instanceof Error && error.message === 'LEAD_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'NOT_IN_VISIT_COMPLETED') {
      return NextResponse.json(
        { success: false, error: 'Lead must be in VISIT_PHASE / VISIT_COMPLETED stage' },
        { status: 409 },
      )
    }
    if (error instanceof Error && error.message === 'ALREADY_ASSIGNED') {
      return NextResponse.json(
        { success: false, error: 'A JR Architect is already assigned for this lead' },
        { status: 409 },
      )
    }

    console.error('[visit-complete-queue/request][POST] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to submit request' },
      { status: 500 },
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'POST, OPTIONS' },
  })
}
