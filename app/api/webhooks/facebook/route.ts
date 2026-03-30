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

function maskValue(value: string) {
  if (!value) return ''
  if (value.length <= 6) return '*'.repeat(value.length)
  return `${value.slice(0, 3)}***${value.slice(-3)}`
}

function getSearchParam(request: NextRequest, keys: string[]): string {
  for (const key of keys) {
    const value = request.nextUrl.searchParams.get(key)
    if (value && value.trim()) return value.trim()
  }
  return ''
}

function getConfiguredVerifyTokens(): string[] {
  const candidates = [
    process.env.FB_WEBHOOK_VERIFY_TOKEN,
    process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN,
  ]

  return candidates
    .map((value) => (value ?? '').trim())
    .filter((value, index, list) => Boolean(value) && list.indexOf(value) === index)
}

// Webhook verification endpoint required by Meta:
// GET /api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
export async function GET(request: NextRequest) {
  const search = request.nextUrl.search
  const allParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const queryKeys = Array.from(request.nextUrl.searchParams.keys())
  const userAgent = request.headers.get('user-agent') ?? 'unknown'
  const forwardedFor = request.headers.get('x-forwarded-for') ?? 'unknown'

  const mode = getSearchParam(request, ['hub.mode', 'hub_mode'])
  const token = getSearchParam(request, ['hub.verify_token', 'hub_verify_token'])
  const challenge = getSearchParam(request, ['hub.challenge', 'hub_challenge'])
  const verifyTokens = getConfiguredVerifyTokens()
  const tokenMatches = Boolean(token) && verifyTokens.includes(token)

  console.log('[GET /api/webhooks/facebook] incoming request')
  console.log({
    method: request.method,
    url: request.nextUrl.toString(),
    search,
    allParams,
    queryKeys,
    query: {
      'hub.mode': mode || null,
      'hub.verify_token': token ? maskValue(token) : null,
      'hub.challenge': challenge ? maskValue(challenge) : null,
    },
    headers: {
      userAgent,
      xForwardedFor: forwardedFor,
      contentType: request.headers.get('content-type'),
    },
    compare: {
      incomingTokenLength: token.length,
      envTokenLengths: verifyTokens.map((value) => value.length),
      configuredTokenCount: verifyTokens.length,
      tokenMatches,
    },
  })

  if (mode === 'subscribe' && token && challenge && tokenMatches) {
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
    console.log('[POST /api/webhooks/facebook] incoming request')
    console.log({
      method: request.method,
      url: request.nextUrl.toString(),
      headers: {
        userAgent: request.headers.get('user-agent'),
        xForwardedFor: request.headers.get('x-forwarded-for'),
        contentType: request.headers.get('content-type'),
      },
    })

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
