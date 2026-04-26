import { NextRequest, NextResponse } from 'next/server'

import { requireDatabaseRoles } from '@/lib/authz'
import {
  getVisitWorkflowControlState,
  setVisitSupportDataEnabled,
} from '@/lib/visit-workflow-control'

export const runtime = 'nodejs'
export const preferredRegion = 'sin1'

type UpdateBody = {
  supportDataEnabled?: unknown
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function isAdminDepartment(departments: string[]): boolean {
  return departments.includes('ADMIN')
}

export async function GET() {
  const authResult = await requireDatabaseRoles([])
  if (!authResult.ok) return authResult.response

  const control = await getVisitWorkflowControlState()

  return NextResponse.json({
    success: true,
    data: {
      control,
    },
  })
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireDatabaseRoles([])
  if (!authResult.ok) return authResult.response

  if (!isAdminDepartment(authResult.actor.userDepartments)) {
    return NextResponse.json(
      { success: false, error: 'Only admin can update visit workflow settings' },
      { status: 403 },
    )
  }

  let body: UpdateBody
  try {
    body = (await request.json()) as UpdateBody
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const supportDataEnabled = toOptionalBoolean(body.supportDataEnabled)
  if (typeof supportDataEnabled !== 'boolean') {
    return NextResponse.json(
      { success: false, error: 'supportDataEnabled must be boolean' },
      { status: 400 },
    )
  }

  const control = await setVisitSupportDataEnabled(supportDataEnabled)

  return NextResponse.json({
    success: true,
    data: {
      control,
    },
    message: supportDataEnabled
      ? 'Support workflow enabled'
      : 'Support workflow disabled (support members become read-only)',
  })
}
