import { NextRequest, NextResponse } from 'next/server'
import { requireDatabaseRoles } from '@/lib/authz'
import { getFacebookConfigStatus } from '@/lib/facebook'
import {
  getFacebookSyncControlState,
  updateFacebookSyncControlState,
} from '@/lib/facebook-sync-control'

type UpdateBody = {
  enabled?: unknown
  latestEnabled?: unknown
  latestIntervalMinutes?: unknown
  latestBatchLimit?: unknown
  backfillEnabled?: unknown
  backfillIntervalMinutes?: unknown
  backfillBatchLimit?: unknown
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

  const [syncControl, facebookConfig] = await Promise.all([
    getFacebookSyncControlState(),
    Promise.resolve(getFacebookConfigStatus()),
  ])

  return NextResponse.json({
    success: true,
    data: {
      syncControl,
      facebookConfig,
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

  const updated = await updateFacebookSyncControlState({
    enabled: toOptionalBoolean(body.enabled),
    latestEnabled: toOptionalBoolean(body.latestEnabled),
    latestIntervalMinutes: toOptionalNumber(body.latestIntervalMinutes),
    latestBatchLimit: toOptionalNumber(body.latestBatchLimit),
    backfillEnabled: toOptionalBoolean(body.backfillEnabled),
    backfillIntervalMinutes: toOptionalNumber(body.backfillIntervalMinutes),
    backfillBatchLimit: toOptionalNumber(body.backfillBatchLimit),
    fallbackEnabled: toOptionalBoolean(body.fallbackEnabled),
    fallbackIntervalMinutes: toOptionalNumber(body.fallbackIntervalMinutes),
    batchLimit: toOptionalNumber(body.batchLimit),
  })

  return NextResponse.json({
    success: true,
    data: {
      syncControl: updated,
      facebookConfig: getFacebookConfigStatus(),
    },
    message: 'Facebook sync settings updated',
  })
}
