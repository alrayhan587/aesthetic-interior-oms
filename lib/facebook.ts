import 'server-only'

import prisma from '@/lib/prisma'

type FacebookConversation = {
  id: string
  updated_time?: string
  participants?: {
    data?: Array<{
      id?: string
      name?: string
    }>
  }
  messages?: {
    data?: Array<{
      id?: string
      message?: string
      created_time?: string
      from?: {
        id?: string
        name?: string
      }
    }>
  }
}

type FacebookConversationResponse = {
  data?: FacebookConversation[]
}

type SyncFacebookOptions = {
  limit?: number
}

type SyncFacebookResult = {
  fetchedConversations: number
  createdLeads: number
}

const FB_DEFAULT_LIMIT = 20

function getFacebookConfig() {
  const token = process.env.FB_PAGE_ACCESS_TOKEN
  const pageId = process.env.FB_PAGE_ID
  const graphVersion = process.env.FB_GRAPH_VERSION || 'v25.0'
  return { token, pageId, graphVersion }
}

export function isFacebookConfigured(): boolean {
  const { token, pageId } = getFacebookConfig()
  return Boolean(token && pageId)
}

function conversationMarker(conversationId: string): string {
  return `FB_CONVERSATION_ID:${conversationId}`
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const { token, graphVersion } = getFacebookConfig()
  if (!token) {
    throw new Error('FB_PAGE_ACCESS_TOKEN is missing')
  }

  const query = new URLSearchParams({
    ...params,
    access_token: token,
  })
  const url = `https://graph.facebook.com/${graphVersion}${path}?${query.toString()}`

  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Facebook Graph API error (${response.status}): ${errorText}`)
  }

  return (await response.json()) as T
}

export async function fetchRecentFacebookConversations(limit = FB_DEFAULT_LIMIT): Promise<FacebookConversation[]> {
  const { pageId } = getFacebookConfig()
  if (!pageId) {
    throw new Error('FB_PAGE_ID is missing')
  }

  const payload = await graphGet<FacebookConversationResponse>(`/${pageId}/conversations`, {
    fields:
      'id,updated_time,participants.limit(10){id,name},messages.limit(1){id,message,created_time,from{id,name}}',
    limit: String(limit),
  })

  return Array.isArray(payload.data) ? payload.data : []
}

function extractCustomerName(conversation: FacebookConversation, pageId: string): string | null {
  const participants = conversation.participants?.data ?? []
  const customer = participants.find((participant) => participant.id && participant.id !== pageId)
  const normalized = customer?.name?.trim()
  return normalized && normalized.length > 0 ? normalized : null
}

export async function syncRecentFacebookConversationsToLeads(
  options: SyncFacebookOptions = {},
): Promise<SyncFacebookResult> {
  const { pageId } = getFacebookConfig()
  if (!pageId || !isFacebookConfigured()) {
    return { fetchedConversations: 0, createdLeads: 0 }
  }

  const conversations = await fetchRecentFacebookConversations(options.limit ?? FB_DEFAULT_LIMIT)
  let createdLeads = 0

  for (const conversation of conversations) {
    if (!conversation.id) {
      continue
    }

    const marker = conversationMarker(conversation.id)
    const existing = await prisma.lead.findFirst({
      where: {
        source: { equals: 'Facebook', mode: 'insensitive' },
        remarks: { contains: marker },
      },
      select: { id: true },
    })

    if (existing) {
      continue
    }

    const customerName =
      extractCustomerName(conversation, pageId) ??
      `Facebook User ${conversation.id.slice(-6)}`

    const lastMessage = conversation.messages?.data?.[0]?.message?.trim() ?? ''

    await prisma.lead.create({
      data: {
        name: customerName,
        source: 'Facebook',
        remarks: lastMessage
          ? `${marker}\nImported from Facebook.\nLast message: ${lastMessage}`
          : `${marker}\nImported from Facebook conversation.`,
      },
    })

    createdLeads += 1
  }

  return {
    fetchedConversations: conversations.length,
    createdLeads,
  }
}
