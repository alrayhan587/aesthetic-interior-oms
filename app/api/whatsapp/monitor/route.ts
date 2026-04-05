import { NextRequest, NextResponse } from 'next/server'

import { requireDatabaseRoles } from '@/lib/authz'
import { getRecentWhatsAppWebhookEvents, getWhatsAppControlState } from '@/lib/whatsapp-control'

export const runtime = 'nodejs'
export const preferredRegion = 'sin1'

function toLimit(value: string | null): number {
  if (!value) return 20
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return 20
  return Math.min(Math.max(parsed, 1), 100)
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const limit = toLimit(request.nextUrl.searchParams.get('limit'))

    const [control, recentEvents] = await Promise.all([
      getWhatsAppControlState(),
      getRecentWhatsAppWebhookEvents(limit),
    ])

    return NextResponse.json({
      success: true,
      data: {
        checkedAt: new Date().toISOString(),
        control,
        recentEvents,
        config: {
          verifyTokenConfigured: Boolean(
            process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN,
          ),
          appSecretConfigured: Boolean(process.env.META_APP_SECRET),
          wawpSecretConfigured: Boolean(process.env.WAWP_WEBHOOK_SECRET),
        },
      },
    })
  } catch (error) {
    console.error('[GET /api/whatsapp/monitor] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load WhatsApp monitor data' },
      { status: 500 },
    )
  }
}
