import { NextRequest, NextResponse } from 'next/server'
import { maybeRunInstagramFallbackSync } from '@/lib/instagram-sync-control'

export const runtime = 'nodejs'

function isCronAuthorized(request: NextRequest): boolean {
  const configuredSecret = process.env.IG_SYNC_CRON_SECRET?.trim()
  if (!configuredSecret) {
    return true
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const incomingToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : ''

  return incomingToken.length > 0 && incomingToken === configuredSecret
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized cron request' },
      { status: 401 },
    )
  }

  try {
    const result = await maybeRunInstagramFallbackSync()
    return NextResponse.json({
      success: true,
      data: result,
      message: result.ran ? 'Fallback sync executed' : 'Fallback sync skipped',
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Fallback sync failed',
      },
      { status: 500 },
    )
  }
}
