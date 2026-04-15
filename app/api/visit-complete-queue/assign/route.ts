import { NextRequest, NextResponse } from 'next/server'
import { requireDatabaseRoles } from '@/lib/authz'
import { assignJrArchitectFromVisitComplete } from '@/lib/visit-complete-queue'

type AssignBody = {
  leadId?: unknown
  jrArchitectUserId?: unknown
  requestId?: unknown
  reason?: unknown
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

    const body = (await request.json()) as AssignBody
    const leadId = toOptionalString(body.leadId)
    const jrArchitectUserId = toOptionalString(body.jrArchitectUserId)
    const requestId = toOptionalString(body.requestId)
    const reason = toOptionalString(body.reason)

    if (!leadId || !jrArchitectUserId) {
      return NextResponse.json(
        { success: false, error: 'leadId and jrArchitectUserId are required' },
        { status: 400 },
      )
    }

    const result = await assignJrArchitectFromVisitComplete({
      actorUserId: authResult.actorUserId,
      actorDepartments: authResult.actor.userDepartments ?? [],
      leadId,
      jrArchitectUserId,
      requestId,
      reason,
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: 'JR Architect assigned and CAD task created successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json(
        { success: false, error: 'Only Admin, Senior CRM, or Visit Team can assign JR Architect' },
        { status: 403 },
      )
    }
    if (error instanceof Error && error.message === 'VISIT_TEAM_NOT_ALLOWED') {
      return NextResponse.json(
        { success: false, error: 'Visit Team can only assign from their own completed visits' },
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
    if (error instanceof Error && error.message === 'JR_ARCHITECT_NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: 'Selected JR Architect user is invalid or inactive' },
        { status: 400 },
      )
    }

    console.error('[visit-complete-queue/assign][POST] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to assign JR Architect' },
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
