import { NextRequest, NextResponse } from 'next/server'
import { isFacebookConfigured, syncRecentFacebookConversationsToLeads } from '@/lib/facebook'

export const runtime = 'nodejs'
export const preferredRegion = 'sin1'
export const dynamic = 'force-dynamic'

type FacebookWebhookEntry = {
  id?: string
  messaging?: Array<{
    sender?: { id?: string }
    recipient?: { id?: string }
    timestamp?: number
    message?: { mid?: string; text?: string }
    postback?: { title?: string; payload?: string }
  }>
}

type FacebookWebhookPayload = {
  object?: string
  entry?: FacebookWebhookEntry[]
}

function normalizeToken(value: string | null | undefined) {
  const trimmed = (value ?? '').trim()
  // Guard against accidental wrapping quotes in env dashboards/copies.
  return trimmed.replace(/^['"]+|['"]+$/g, '')
}

function getVerifyToken() {
  return normalizeToken(process.env.FB_WEBHOOK_VERIFY_TOKEN ?? '')
}

// Webhook verification endpoint required by Meta:
// GET /api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode')
  const token = normalizeToken(request.nextUrl.searchParams.get('hub.verify_token'))
  const challenge = request.nextUrl.searchParams.get('hub.challenge')
  const verifyToken = getVerifyToken()
  console.info(
    `[GET /api/webhooks/facebook] mode=${mode ?? 'null'} token_len=${token.length} verify_configured=${Boolean(
      verifyToken,
    )} verify_len=${verifyToken.length} has_challenge=${Boolean(challenge)}`,
  )

  if (mode === 'subscribe' && token && verifyToken && challenge && token === verifyToken) {
    console.info('[GET /api/webhooks/facebook] verification success')
    return new NextResponse(challenge ?? '', { status: 200 })
  }

  console.warn(
    `[GET /api/webhooks/facebook] verification failed mode=${mode ?? 'null'} token_len=${token.length} verify_configured=${Boolean(
      verifyToken,
    )} verify_len=${verifyToken.length} has_challenge=${Boolean(challenge)}`,
  )

  return NextResponse.json({ success: false, error: 'Webhook verification failed' }, { status: 403 })
}

// Event receiver endpoint (messages/postbacks)
export async function POST(request: NextRequest) {
  try {
    console.info('[POST /api/webhooks/facebook] received webhook event')
    if (!isFacebookConfigured()) {
      console.warn('[POST /api/webhooks/facebook] ignored because Facebook config is missing')
      return NextResponse.json(
        { success: false, error: 'Facebook Graph API is not configured' },
        { status: 400 },
      )
    }

    const rawBody = await request.text()
    if (!rawBody.trim()) {
      console.warn('[POST /api/webhooks/facebook] empty request body')
      return NextResponse.json(
        { success: false, error: 'Empty webhook body' },
        { status: 400 },
      )
    }

    let payload: FacebookWebhookPayload
    try {
      payload = JSON.parse(rawBody) as FacebookWebhookPayload
    } catch (parseError) {
      console.error('[POST /api/webhooks/facebook] invalid JSON body:', parseError)
      return NextResponse.json(
        { success: false, error: 'Invalid JSON webhook body' },
        { status: 400 },
      )
    }

    const entryCount = (payload.entry ?? []).length
    const messagingEventCount = (payload.entry ?? []).reduce(
      (acc, entry) => acc + (entry.messaging?.length ?? 0),
      0,
    )
    console.info(
      `[POST /api/webhooks/facebook] object=${payload.object ?? 'unknown'} entries=${entryCount} messaging_events=${messagingEventCount}`,
    )
    if (payload.object !== 'page') {
      console.info(`[POST /api/webhooks/facebook] ignored payload with object=${payload.object ?? 'unknown'}`)
      return NextResponse.json({ success: true, ignored: true })
    }

    const hasMessageLikeEvent = (payload.entry ?? []).some((entry) =>
      (entry.messaging ?? []).some((event) => Boolean(event.message || event.postback)),
    )

    // Keep webhook response fast; only sync when there is a relevant event.
    if (hasMessageLikeEvent) {
      console.info('[POST /api/webhooks/facebook] message-like event detected, starting sync')
      const result = await syncRecentFacebookConversationsToLeads({ limit: 20 })
      console.info(
        `[POST /api/webhooks/facebook] sync completed fetched=${result.fetchedConversations} created=${result.createdLeads}`,
      )
      return NextResponse.json({ success: true, synced: result })
    }

    console.info('[POST /api/webhooks/facebook] no message-like events, returning ignored')
    return NextResponse.json({ success: true, ignored: true })
  } catch (error) {
    console.error('[POST /api/webhooks/facebook] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to process facebook webhook' }, { status: 500 })
  }
}
