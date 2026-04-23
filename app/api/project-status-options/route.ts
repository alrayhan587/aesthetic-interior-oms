import { NextResponse } from 'next/server'
import { ProjectStatus } from '@/generated/prisma/client'
import { requireDatabaseRoles } from '@/lib/authz'

function toLabel(value: ProjectStatus): string {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
}

export async function GET() {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const values = Object.values(ProjectStatus)
    return NextResponse.json({
      success: true,
      data: values.map((value) => ({
        value,
        label: toLabel(value),
      })),
    })
  } catch (error) {
    console.error('[project-status-options][GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch project status options' }, { status: 500 })
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
