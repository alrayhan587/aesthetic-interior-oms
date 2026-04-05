import { NextResponse } from 'next/server'
import { requireDatabaseRoles } from '@/lib/authz'
import { getFacebookConfigStatus } from '@/lib/facebook'
import {
  FacebookSyncLane,
  recordFacebookSyncResult,
  runFacebookSyncWithControl,
} from '@/lib/facebook-sync-control'

type SyncRequestBody = {
  lane?: unknown
}

function parseLane(value: unknown): FacebookSyncLane {
  if (value === 'LATEST' || value === 'BACKFILL' || value === 'BOTH') {
    return value
  }
  return 'BOTH'
}

export async function POST(request: Request) {
  console.info('[POST /api/facebook/sync] started')
  const authResult = await requireDatabaseRoles([])
  if (!authResult.ok) {
    console.warn('[POST /api/facebook/sync] unauthorized request')
    return authResult.response
  }

  const facebookConfig = getFacebookConfigStatus()
  if (!facebookConfig.configured) {
    console.warn('[POST /api/facebook/sync] config missing, aborting')
    return NextResponse.json(
      { success: false, error: 'Facebook Graph API is not configured' },
      { status: 400 },
    )
  }

  let lane: FacebookSyncLane = 'BOTH'
  try {
    const body = (await request.json()) as SyncRequestBody
    lane = parseLane(body?.lane)
  } catch {
    lane = 'BOTH'
  }

  try {
    const result = await runFacebookSyncWithControl('MANUAL', lane)
    if (!result.ran) {
      return NextResponse.json(
        {
          success: false,
          error: `Sync skipped: ${result.reason ?? 'unknown reason'}`,
        },
        { status: 400 },
      )
    }
    console.info(
      `[POST /api/facebook/sync] sync completed lane=${lane} fetched=${result.fetchedConversations} created=${result.createdLeads}`,
    )
    return NextResponse.json({
      success: true,
      data: result,
      message: `Facebook ${lane.toLowerCase()} sync completed`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync Facebook conversations'
    await recordFacebookSyncResult({
      trigger: 'MANUAL',
      status: 'FAILED',
      error: message,
    })
    console.error('[POST /api/facebook/sync] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to sync Facebook conversations' },
      { status: 500 },
    )
  }
}
