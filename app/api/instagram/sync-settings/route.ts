import { NextRequest, NextResponse } from 'next/server'
import { requireDatabaseRoles } from '@/lib/authz'
import { getInstagramConfigStatus } from '@/lib/instagram'
import {
  getInstagramSyncControlState,
  updateInstagramSyncControlState,
} from '@/lib/instagram-sync-control'

type UpdateBody = {
  enabled?: unknown
  fallbackEnabled?: unknown
  fallbackIntervalMinutes?: unknown
  batchLimit?: unknown
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export async function GET() {
  const authResult = await requireDatabaseRoles([])
  if (!authResult.ok) {
    return authResult.response
  }

  const [syncControl, instagramConfig] = await Promise.all([
    getInstagramSyncControlState(),
    Promise.resolve(getInstagramConfigStatus()),
  ])

  return NextResponse.json({
    success: true,
    data: {
      syncControl,
      instagramConfig,
    },
  })
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireDatabaseRoles([])
  if (!authResult.ok) {
    return authResult.response
  }

  let body: UpdateBody
  try {
    body = (await request.json()) as UpdateBody
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const updated = await updateInstagramSyncControlState({
    enabled: toOptionalBoolean(body.enabled),
    fallbackEnabled: toOptionalBoolean(body.fallbackEnabled),
    fallbackIntervalMinutes: toOptionalNumber(body.fallbackIntervalMinutes),
    batchLimit: toOptionalNumber(body.batchLimit),
  })

  return NextResponse.json({
    success: true,
    data: {
      syncControl: updated,
      instagramConfig: getInstagramConfigStatus(),
    },
    message: 'Instagram sync settings updated',
  })
}
