import 'server-only'

import prisma from '@/lib/prisma'
import { ActivityType, LeadAssignmentDepartment, LeadStage } from '@/generated/prisma/client'
import {
  buildPhoneLookupVariants,
  extractNormalizedPhonesSmart,
  formatPhoneForStorage,
} from '@/lib/phone-normalize'

type InstagramConversation = {
  id: string
  updated_time?: string
  participants?: {
    data?: Array<{
      id?: string
      name?: string
      username?: string
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
        username?: string
      }
    }>
  }
}

type InstagramConversationResponse = {
  data?: InstagramConversation[]
  paging?: {
    cursors?: {
      after?: string
    }
    next?: string
  }
}

type InstagramEntityProfile = {
  id?: string
  name?: string
  username?: string
}

type FetchInstagramConversationPageOptions = {
  limit?: number
  afterCursor?: string | null
}

type FetchInstagramConversationPageResult = {
  conversations: InstagramConversation[]
  nextCursor: string | null
}

type SyncInstagramIncrementalOptions = {
  limit?: number
  afterCursor?: string | null
  watermarkIso?: string | null
  jrCrmRoundRobinOffset?: number
}

type SyncInstagramIncrementalResult = {
  fetchedConversations: number
  createdLeads: number
  nextCursor: string | null
  maxUpdatedTimeIso: string | null
  nextJrCrmRoundRobinOffset: number
}

type JrCrmAgent = {
  id: string
  fullName: string
}

const IG_DEFAULT_LIMIT = 20
const IG_DEFAULT_MESSAGE_LOOKBACK_LIMIT = 50
const IG_LOG_PREFIX = '[instagram-lib]'

function clampMessageLookbackLimit(value: number): number {
  if (!Number.isFinite(value)) return IG_DEFAULT_MESSAGE_LOOKBACK_LIMIT
  return Math.max(10, Math.min(100, Math.trunc(value)))
}

function getConversationMessageLookbackLimit(): number {
  const raw = Number(process.env.IG_CONVERSATION_MESSAGE_LOOKBACK_LIMIT ?? IG_DEFAULT_MESSAGE_LOOKBACK_LIMIT)
  return clampMessageLookbackLimit(raw)
}

function getInstagramConfig() {
  const token = process.env.IG_ACCESS_TOKEN
  const entityId = process.env.IG_ENTITY_ID
  const graphVersion = process.env.IG_GRAPH_VERSION || 'v25.0'
  return { token, entityId, graphVersion }
}

export function isInstagramConfigured(): boolean {
  const { token, entityId } = getInstagramConfig()
  return Boolean(token && entityId)
}

export function getInstagramConfigStatus() {
  const { token, entityId, graphVersion } = getInstagramConfig()
  return {
    tokenConfigured: Boolean(token),
    entityIdConfigured: Boolean(entityId),
    graphVersion,
    entityId: entityId ?? null,
    configured: Boolean(token && entityId),
  }
}

function conversationMarker(conversationId: string): string {
  return `IG_CONVERSATION_ID:${conversationId}`
}

function getConversationMessages(conversation: InstagramConversation): string[] {
  return (conversation.messages?.data ?? [])
    .map((item) => item.message?.trim() ?? '')
    .filter((item) => item.length > 0)
}

function extractPhonesFromMessages(messages: string[]): string[] {
  const seen = new Set<string>()
  const phones: string[] = []
  for (const message of messages) {
    const extracted = extractNormalizedPhonesSmart(message, { preferBangladesh: true })
    for (const phone of extracted) {
      if (!seen.has(phone)) {
        seen.add(phone)
        phones.push(phone)
      }
    }
  }
  return phones
}

function buildLookupCandidatesFromPhones(phones: string[]): string[] {
  const variants = new Set<string>()
  for (const phone of phones) {
    for (const item of buildPhoneLookupVariants(phone)) {
      variants.add(item)
    }
  }
  return Array.from(variants)
}

function extractCustomerName(conversation: InstagramConversation, entityId: string): string | null {
  const participants = conversation.participants?.data ?? []
  const customer = participants.find((participant) => participant.id && participant.id !== entityId)
  const fromName = customer?.name?.trim()
  if (fromName) return fromName
  const username = customer?.username?.trim()
  if (username) return username
  return null
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const { token, graphVersion } = getInstagramConfig()
  if (!token) {
    throw new Error('IG_ACCESS_TOKEN is missing')
  }

  const query = new URLSearchParams({
    ...params,
    access_token: token,
  })
  const url = `https://graph.facebook.com/${graphVersion}${path}?${query.toString()}`

  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Instagram Graph API error (${response.status}): ${errorText}`)
  }

  return (await response.json()) as T
}

async function fetchInstagramConversationPage(
  options: FetchInstagramConversationPageOptions = {},
): Promise<FetchInstagramConversationPageResult> {
  const { entityId } = getInstagramConfig()
  if (!entityId) {
    throw new Error('IG_ENTITY_ID is missing')
  }

  const limit = options.limit ?? IG_DEFAULT_LIMIT
  const messageLookbackLimit = getConversationMessageLookbackLimit()
  const afterCursor = options.afterCursor?.trim() || null

  const payload = await graphGet<InstagramConversationResponse>(`/${entityId}/conversations`, {
    fields:
      `id,updated_time,participants.limit(10){id,name,username},messages.limit(${messageLookbackLimit}){id,message,created_time,from{id,name,username}}`,
    limit: String(limit),
    ...(afterCursor ? { after: afterCursor } : {}),
  })

  const conversations = Array.isArray(payload.data) ? payload.data : []
  const nextCursor = payload.paging?.next ? payload.paging?.cursors?.after ?? null : null
  return { conversations, nextCursor }
}

export async function checkInstagramGraphConnection() {
  const { entityId } = getInstagramConfig()
  if (!entityId) {
    return {
      ok: false as const,
      error: 'IG_ENTITY_ID is missing',
    }
  }

  try {
    const profile = await graphGet<InstagramEntityProfile>(`/${entityId}`, {
      fields: 'id,name,username',
    })
    const sample = await fetchInstagramConversationPage({ limit: 3 })
    return {
      ok: true as const,
      entityId: profile.id ?? entityId,
      entityName: profile.name ?? profile.username ?? null,
      sampleConversationCount: sample.conversations.length,
    }
  } catch (error) {
    console.error(`${IG_LOG_PREFIX} graph_connection_check failed:`, error)
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Unknown Graph API error',
    }
  }
}

async function getActiveJrCrmAgents(): Promise<JrCrmAgent[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      userDepartments: {
        some: {
          department: {
            name: 'JR_CRM',
          },
        },
      },
    },
    select: {
      id: true,
      fullName: true,
    },
    orderBy: {
      fullName: 'asc',
    },
  })

  return users
}

async function importConversationToLead(
  conversation: InstagramConversation,
  entityId: string,
  options: {
    jrCrmAgents: JrCrmAgent[]
    jrCrmRoundRobinOffset: number
  },
): Promise<{ created: boolean; usedRoundRobin: boolean }> {
  if (!conversation.id) {
    return { created: false, usedRoundRobin: false }
  }

  const messages = getConversationMessages(conversation)
  const lastMessage = messages[0] ?? ''
  const detectedPhones = extractPhonesFromMessages(messages)
  const detectedPrimaryPhone = detectedPhones[0] ?? null
  const phoneLookupCandidates = buildLookupCandidatesFromPhones(detectedPhones)

  const marker = conversationMarker(conversation.id)
  const existing = await prisma.lead.findFirst({
    where: {
      source: { equals: 'Instagram', mode: 'insensitive' },
      remarks: { contains: marker },
    },
    select: { id: true, phone: true },
  })

  if (existing) {
    if (detectedPrimaryPhone && !existing.phone) {
      const existingByPhone = await prisma.lead.findFirst({
        where: {
          phone: { in: phoneLookupCandidates },
          id: { not: existing.id },
        },
        select: { id: true },
      })
      if (!existingByPhone) {
        await prisma.lead.update({
          where: { id: existing.id },
          data: {
            phone: formatPhoneForStorage(detectedPrimaryPhone),
            stage: LeadStage.NUMBER_COLLECTED,
          },
        })
      }
    }

    return { created: false, usedRoundRobin: false }
  }

  const customerName =
    extractCustomerName(conversation, entityId) ??
    `Instagram User ${conversation.id.slice(-6)}`

  if (detectedPrimaryPhone) {
    const existingByPhone = await prisma.lead.findFirst({
      where: { phone: { in: phoneLookupCandidates } },
      select: { id: true },
    })
    if (existingByPhone) {
      return { created: false, usedRoundRobin: false }
    }
  }

  let assignee: JrCrmAgent | null = null
  let usedRoundRobin = false
  if (options.jrCrmAgents.length > 0) {
    const index = options.jrCrmRoundRobinOffset % options.jrCrmAgents.length
    assignee = options.jrCrmAgents[index]
    usedRoundRobin = true
  }

  const stage = detectedPrimaryPhone ? LeadStage.NUMBER_COLLECTED : LeadStage.NEW
  const storedPrimaryPhone = formatPhoneForStorage(detectedPrimaryPhone)
  const detectedPhonesRemark =
    detectedPhones.length > 0 ? `\nDetected phones: ${detectedPhones.map((p) => formatPhoneForStorage(p) ?? p).join(', ')}` : ''

  await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        name: customerName,
        source: 'Instagram',
        phone: storedPrimaryPhone,
        stage,
        assignedTo: assignee?.id ?? null,
        remarks: lastMessage
          ? `${marker}\nImported from Instagram.\nLast message: ${lastMessage}${detectedPhonesRemark}`
          : `${marker}\nImported from Instagram conversation.${detectedPhonesRemark}`,
      },
      select: { id: true },
    })

    if (assignee) {
      await tx.leadAssignment.create({
        data: {
          leadId: lead.id,
          userId: assignee.id,
          department: LeadAssignmentDepartment.JR_CRM,
        },
      })

      await tx.activityLog.create({
        data: {
          leadId: lead.id,
          userId: assignee.id,
          type: ActivityType.LEAD_CREATED,
          description: `Lead "${customerName}" was created from Instagram chat.`,
        },
      })
    }
  })

  return { created: true, usedRoundRobin }
}

export async function syncInstagramConversationsIncremental(
  options: SyncInstagramIncrementalOptions = {},
): Promise<SyncInstagramIncrementalResult> {
  const { entityId } = getInstagramConfig()
  const limit = options.limit ?? IG_DEFAULT_LIMIT
  const afterCursor = options.afterCursor?.trim() || null
  const watermark = options.watermarkIso ? new Date(options.watermarkIso) : null
  const watermarkMs = watermark && !Number.isNaN(watermark.getTime()) ? watermark.getTime() : null
  const jrCrmAgents = await getActiveJrCrmAgents()
  let jrCrmRoundRobinOffset = Math.max(0, options.jrCrmRoundRobinOffset ?? 0)

  if (!entityId || !isInstagramConfigured()) {
    return {
      fetchedConversations: 0,
      createdLeads: 0,
      nextCursor: null,
      maxUpdatedTimeIso: options.watermarkIso ?? null,
      nextJrCrmRoundRobinOffset: jrCrmRoundRobinOffset,
    }
  }

  const { conversations, nextCursor } = await fetchInstagramConversationPage({ limit, afterCursor })
  let createdLeads = 0
  let maxUpdatedMs = watermarkMs

  for (const conversation of conversations) {
    const updatedMs = conversation.updated_time ? new Date(conversation.updated_time).getTime() : null
    const isValidUpdatedMs = updatedMs !== null && !Number.isNaN(updatedMs)

    if (afterCursor === null && watermarkMs !== null && isValidUpdatedMs && updatedMs <= watermarkMs) {
      continue
    }

    if (isValidUpdatedMs) {
      maxUpdatedMs = maxUpdatedMs === null ? updatedMs : Math.max(maxUpdatedMs, updatedMs)
    }

    const imported = await importConversationToLead(conversation, entityId, {
      jrCrmAgents,
      jrCrmRoundRobinOffset,
    })

    if (imported.created) {
      createdLeads += 1
      if (imported.usedRoundRobin && jrCrmAgents.length > 0) {
        jrCrmRoundRobinOffset = (jrCrmRoundRobinOffset + 1) % jrCrmAgents.length
      }
    }
  }

  const maxUpdatedTimeIso = maxUpdatedMs === null ? null : new Date(maxUpdatedMs).toISOString()

  return {
    fetchedConversations: conversations.length,
    createdLeads,
    nextCursor,
    maxUpdatedTimeIso,
    nextJrCrmRoundRobinOffset: jrCrmRoundRobinOffset,
  }
}
