import { NextRequest, NextResponse } from 'next/server'
import { requireDatabaseRoles } from '@/lib/authz'
import {
  checkFacebookGraphConnection,
  fetchFacebookLatestMonitor,
  getFacebookConfigStatus,
} from '@/lib/facebook'
import {
  FacebookSyncLane,
  getFacebookSyncControlState,
  runFacebookSyncWithControl,
} from '@/lib/facebook-sync-control'

export const runtime = 'nodejs'
export const preferredRegion = 'sin1'

function parseLane(value: string | null): FacebookSyncLane {
  void value
  return 'LATEST'
}

export async function GET(request: NextRequest) {
  const runSync = request.nextUrl.searchParams.get('sync') === '1'
  const lane = parseLane(request.nextUrl.searchParams.get('lane'))
  console.info(`[GET /api/facebook/status] started run_sync=${runSync} lane=${lane}`)

  const authResult = await requireDatabaseRoles([])
  if (!authResult.ok) {
    console.warn('[GET /api/facebook/status] unauthorized request')
    return authResult.response
  }

  const config = getFacebookConfigStatus()
  console.info(
    `[GET /api/facebook/status] config configured=${config.configured} token_configured=${config.tokenConfigured} page_id_configured=${config.pageIdConfigured} graph_version=${config.graphVersion}`,
  )
  const graphConnection = await checkFacebookGraphConnection()
  console.info(
    `[GET /api/facebook/status] graph_connection ok=${graphConnection.ok} error_present=${Boolean(
      'error' in graphConnection ? graphConnection.error : null,
    )} sample_count=${
      'sampleConversationCount' in graphConnection ? graphConnection.sampleConversationCount : 0
    }`,
  )

  let syncResult: Awaited<ReturnType<typeof runFacebookSyncWithControl>> | null = null
  let syncError: string | null = null
  if (runSync && config.configured) {
    try {
      console.info(`[GET /api/facebook/status] running sync via query param lane=${lane}`)
      syncResult = await runFacebookSyncWithControl('MANUAL', lane)
      console.info(
        `[GET /api/facebook/status] sync completed lane=${lane} fetched=${syncResult.fetchedConversations} created=${syncResult.createdLeads}`,
      )
    } catch (error) {
      syncError = error instanceof Error ? error.message : 'Failed to run Facebook sync'
      console.error('[GET /api/facebook/status] sync failed:', error)
    }
  } else if (runSync && !config.configured) {
    console.warn('[GET /api/facebook/status] sync requested but config is incomplete')
  }

  console.info('[GET /api/facebook/status] completed')
  const syncControl = await getFacebookSyncControlState()
  const monitorLimit = Math.min(Math.max(syncControl.lastLatestSyncFetched ?? 0, 0), 100)
  const monitor =
    monitorLimit > 0
      ? await fetchFacebookLatestMonitor(monitorLimit, {
          fromWatermarkIso: syncControl.incrementalWatermark,
          toWatermarkIso: syncControl.latestWatermark,
          includeExpandedPhoneScan: false,
        }).catch(() => [])
      : []
  return NextResponse.json({
    success: true,
    data: {
      checkedAt: new Date().toISOString(),
      config: {
        configured: config.configured,
        tokenConfigured: config.tokenConfigured,
        pageIdConfigured: config.pageIdConfigured,
        graphVersion: config.graphVersion,
        pageId: config.pageId,
        verifyTokenConfigured: Boolean(process.env.FB_WEBHOOK_VERIFY_TOKEN),
      },
      graphConnection,
      syncControl,
      monitor,
      syncResult,
      syncError,
      webhookPath: '/api/webhooks/facebook',
    },
  })
}
