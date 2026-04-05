import { NextRequest, NextResponse } from 'next/server'

import prisma from '@/lib/prisma'
import { requireDatabaseRoles } from '@/lib/authz'
import {
  extractFacebookConversationIdFromRemarks,
  fetchFacebookConversationMessagesById,
} from '@/lib/facebook'

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

async function resolveLeadId(context: RouteContext): Promise<string | null> {
  const resolved = await context.params
  const id = typeof resolved?.id === 'string' ? resolved.id.trim() : ''
  return id || null
}

function toLimit(value: string | null): number {
  if (!value) return 100
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return 100
  return Math.min(Math.max(parsed, 1), 200)
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const leadId = await resolveLeadId(context)
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 })
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, source: true, remarks: true },
    })

    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    if ((lead.source ?? '').trim().toLowerCase() !== 'facebook') {
      return NextResponse.json({ success: false, error: 'Lead source is not Facebook' }, { status: 400 })
    }

    const conversationId = extractFacebookConversationIdFromRemarks(lead.remarks)
    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'Facebook conversation id not found on this lead' },
        { status: 404 },
      )
    }

    const limit = toLimit(request.nextUrl.searchParams.get('limit'))
    const messages = await fetchFacebookConversationMessagesById(conversationId, limit)

    return NextResponse.json({
      success: true,
      data: {
        conversationId,
        messages,
      },
    })
  } catch (error) {
    console.error('[GET /api/lead/:id/facebook-messages] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load Facebook messages' }, { status: 500 })
  }
}
