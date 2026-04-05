import { NextRequest, NextResponse } from 'next/server'
import { requireDatabaseRoles } from '@/lib/authz'
import { checkInstagramGraphConnection, getInstagramConfigStatus } from '@/lib/instagram'
import { getInstagramSyncControlState, runInstagramSyncWithControl } from '@/lib/instagram-sync-control'

export const runtime = 'nodejs'
export const preferredRegion = 'sin1'

export async function GET(request: NextRequest) {
  const runSync = request.nextUrl.searchParams.get('sync') === '1'

  const authResult = await requireDatabaseRoles([])
  if (!authResult.ok) {
    return authResult.response
  }

  const config = getInstagramConfigStatus()
  const graphConnection = await checkInstagramGraphConnection()

  let syncResult: Awaited<ReturnType<typeof runInstagramSyncWithControl>> | null = null
  let syncError: string | null = null
  if (runSync && config.configured) {
    try {
      syncResult = await runInstagramSyncWithControl('MANUAL')
    } catch (error) {
      syncError = error instanceof Error ? error.message : 'Failed to run Instagram sync'
    }
  }

  const syncControl = await getInstagramSyncControlState()
  return NextResponse.json({
    success: true,
    data: {
      checkedAt: new Date().toISOString(),
      config: {
        configured: config.configured,
        tokenConfigured: config.tokenConfigured,
        entityIdConfigured: config.entityIdConfigured,
        graphVersion: config.graphVersion,
        entityId: config.entityId,
      },
      graphConnection,
      syncControl,
      syncResult,
      syncError,
    },
  })
}
