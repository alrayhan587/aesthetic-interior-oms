import { NextRequest, NextResponse } from 'next/server'
import { isFacebookConfigured, syncRecentFacebookConversationsToLeads } from '@/lib/facebook'

export const runtime = 'nodejs'
export const preferredRegion = 'sin1'

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

function getVerifyToken() {
  return process.env.FB_WEBHOOK_VERIFY_TOKEN ?? process.env.FB_VERIFY_TOKEN ?? ''
}

// Webhook verification endpoint required by Meta:
// GET /api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode')
  const token = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge')
  const verifyToken = getVerifyToken()

  if (mode === 'subscribe' && token && verifyToken && token === verifyToken) {
    return new NextResponse(challenge ?? '', { status: 200 })
  }

  return NextResponse.json({ success: false, error: 'Webhook verification failed' }, { status: 403 })
}

// Event receiver endpoint (messages/postbacks)
export async function POST(request: NextRequest) {
  try {
    if (!isFacebookConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Facebook Graph API is not configured' },
        { status: 400 },
      )
    }

    const payload = (await request.json()) as FacebookWebhookPayload
    if (payload.object !== 'page') {
      return NextResponse.json({ success: true, ignored: true })
    }

    const hasMessageLikeEvent = (payload.entry ?? []).some((entry) =>
      (entry.messaging ?? []).some((event) => Boolean(event.message || event.postback)),
    )

    // Keep webhook response fast; only sync when there is a relevant event.
    if (hasMessageLikeEvent) {
      const result = await syncRecentFacebookConversationsToLeads({ limit: 20 })
      return NextResponse.json({ success: true, synced: result })
    }

    return NextResponse.json({ success: true, ignored: true })
  } catch (error) {
    console.error('[POST /api/webhooks/facebook] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to process facebook webhook' }, { status: 500 })
  }
}
