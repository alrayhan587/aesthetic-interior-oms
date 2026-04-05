import { NextRequest, NextResponse } from 'next/server'

import {
  getWhatsAppVerifyTokens,
  ingestWawpWebhook,
  ingestWhatsAppWebhook,
  verifyMetaSignature,
} from '@/lib/whatsapp'
import {
  getWhatsAppControlState,
  recordWhatsAppWebhookError,
  recordWhatsAppWebhookResult,
} from '@/lib/whatsapp-control'

export const runtime = 'nodejs'
export const preferredRegion = 'sin1'
export const dynamic = 'force-dynamic'

function getSearchParam(request: NextRequest, keys: string[]): string {
  for (const key of keys) {
    const value = request.nextUrl.searchParams.get(key)
    if (value && value.trim()) return value.trim()
  }
  return ''
}

function maskValue(value: string) {
  if (!value) return ''
  if (value.length <= 6) return '*'.repeat(value.length)
  return `${value.slice(0, 3)}***${value.slice(-3)}`
}

function verifyWawpSecret(request: NextRequest): boolean {
  const expected = process.env.WAWP_WEBHOOK_SECRET?.trim()
  if (!expected) return true

  const headerCandidates = [
    request.headers.get('x-wawp-secret'),
    request.headers.get('x-webhook-secret'),
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''),
  ]
    .map((value) => value?.trim() ?? '')
    .filter(Boolean)

  return headerCandidates.includes(expected)
}

// Meta verification endpoint:
// GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
export async function GET(request: NextRequest) {
  const mode = getSearchParam(request, ['hub.mode', 'hub_mode'])
  const token = getSearchParam(request, ['hub.verify_token', 'hub_verify_token'])
  const challenge = getSearchParam(request, ['hub.challenge', 'hub_challenge'])
  const verifyTokens = getWhatsAppVerifyTokens()
  const tokenMatches = Boolean(token) && verifyTokens.includes(token)

  console.log('[GET /api/webhooks/whatsapp] incoming request')
  console.log({
    url: request.nextUrl.toString(),
    query: {
      'hub.mode': mode || null,
      'hub.verify_token': token ? maskValue(token) : null,
      'hub.challenge': challenge ? maskValue(challenge) : null,
    },
    compare: {
      incomingTokenLength: token.length,
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
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

export async function POST(request: NextRequest) {
  let source: 'META' | 'WAWP' | 'UNKNOWN' = 'UNKNOWN'
  try {
    const control = await getWhatsAppControlState()
    if (!control.enabled) {
      return NextResponse.json(
        { success: true, received: false, reason: 'whatsapp_ingestion_disabled' },
        { status: 200 },
      )
    }

    const rawBody = await request.text()
    if (!rawBody.trim()) {
      return NextResponse.json({ success: true, received: false, reason: 'empty_body' }, { status: 200 })
    }

    const payload = JSON.parse(rawBody) as unknown
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })
    }

    const isMetaPayload =
      'object' in payload &&
      (payload as { object?: unknown }).object === 'whatsapp_business_account'
    const isWawpPayload = 'event' in payload && typeof (payload as { event?: unknown }).event === 'string'

    if (isMetaPayload) {
      source = 'META'
      const signatureHeader = request.headers.get('x-hub-signature-256')
      const signatureValid = verifyMetaSignature(rawBody, signatureHeader)
      if (!signatureValid) {
        console.warn('[POST /api/webhooks/whatsapp] meta signature verification failed')
        return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 })
      }
    } else if (isWawpPayload) {
      source = 'WAWP'
      const wawpSecretValid = verifyWawpSecret(request)
      if (!wawpSecretValid) {
        console.warn('[POST /api/webhooks/whatsapp] WAWP secret verification failed')
        return NextResponse.json({ success: false, error: 'Invalid webhook secret' }, { status: 401 })
      }
    }

    const ingestResult = isWawpPayload
      ? await ingestWawpWebhook(payload as Parameters<typeof ingestWawpWebhook>[0])
      : await ingestWhatsAppWebhook(payload as Parameters<typeof ingestWhatsAppWebhook>[0])
    await recordWhatsAppWebhookResult({
      ...ingestResult,
      source,
    })

    return NextResponse.json(
      {
        success: true,
        received: true,
        data: ingestResult,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('[POST /api/webhooks/whatsapp] error:', error)
    await recordWhatsAppWebhookError(error instanceof Error ? error.message : 'Unknown webhook error', source)
    return NextResponse.json({ success: false, error: 'Failed to process whatsapp webhook' }, { status: 500 })
  }
}
