import { NextRequest, NextResponse } from 'next/server'

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
  entry?: FacebookWebhookEntry[] | unknown[]
}

// Webhook verification endpoint required by Meta:
// GET /api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode') ?? ''
  const token = (request.nextUrl.searchParams.get('hub.verify_token') ?? '').trim()
  const challenge = request.nextUrl.searchParams.get('hub.challenge') ?? ''
  const verifyToken = (process.env.FB_WEBHOOK_VERIFY_TOKEN ?? '').trim()

  if (mode === 'subscribe' && token && challenge && token === verifyToken) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  return new NextResponse('Webhook verification failed', {
    status: 403,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  })
}

// Event receiver endpoint (messages/postbacks)
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    if (!rawBody.trim()) {
      console.log('[POST /api/webhooks/facebook] empty body')
      return NextResponse.json({ success: true, received: false, reason: 'empty_body' }, { status: 200 })
    }

    let payload: FacebookWebhookPayload | { raw: string }
    try {
      payload = JSON.parse(rawBody) as FacebookWebhookPayload
    } catch (parseError) {
      console.warn('[POST /api/webhooks/facebook] non-JSON body received:', parseError)
      payload = { raw: rawBody }
    }

    console.log('[POST /api/webhooks/facebook] received webhook payload:')
    console.dir(payload, { depth: null })

    return NextResponse.json({ success: true, received: true }, { status: 200 })
  } catch (error) {
    console.error('[POST /api/webhooks/facebook] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to process facebook webhook' }, { status: 500 })
  }
}
