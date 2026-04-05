import { NextResponse } from 'next/server'
import { requireDatabaseRoles } from '@/lib/authz'
import { getInstagramConfigStatus } from '@/lib/instagram'
import { recordInstagramSyncResult, runInstagramSyncWithControl } from '@/lib/instagram-sync-control'

export async function POST() {
  const authResult = await requireDatabaseRoles([])
  if (!authResult.ok) {
    return authResult.response
  }

  const config = getInstagramConfigStatus()
  if (!config.configured) {
    return NextResponse.json(
      { success: false, error: 'Instagram Graph API is not configured' },
      { status: 400 },
    )
  }

  try {
    const result = await runInstagramSyncWithControl('MANUAL')
    if (!result.ran) {
      return NextResponse.json(
        {
          success: false,
          error: `Sync skipped: ${result.reason ?? 'unknown reason'}`,
        },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Instagram conversations synced to leads',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync Instagram conversations'
    await recordInstagramSyncResult({
      trigger: 'MANUAL',
      status: 'FAILED',
      error: message,
    })
    return NextResponse.json(
      { success: false, error: 'Failed to sync Instagram conversations' },
      { status: 500 },
    )
  }
}
