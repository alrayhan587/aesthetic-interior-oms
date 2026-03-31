import 'server-only'

import prisma from '@/lib/prisma'
import { ActivityType, LeadAssignmentDepartment, LeadStage } from '@/generated/prisma/client'

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
  paging?: {
    cursors?: {
      before?: string
      after?: string
    }
    next?: string
  }
}

type FacebookPageProfile = {
  id?: string
  name?: string
}

type SyncFacebookOptions = {
  limit?: number
}

type SyncFacebookResult = {
  fetchedConversations: number
  createdLeads: number
}

type FetchFacebookConversationPageOptions = {
  limit?: number
  afterCursor?: string | null
}

type FetchFacebookConversationPageResult = {
  conversations: FacebookConversation[]
  nextCursor: string | null
}

type SyncFacebookIncrementalOptions = {
  limit?: number
  afterCursor?: string | null
  watermarkIso?: string | null
  jrCrmRoundRobinOffset?: number
}

type SyncFacebookIncrementalResult = {
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

const FB_DEFAULT_LIMIT = 20
const FB_LOG_PREFIX = '[facebook-lib]'

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

export function getFacebookConfigStatus() {
  const { token, pageId, graphVersion } = getFacebookConfig()
  return {
    tokenConfigured: Boolean(token),
    pageIdConfigured: Boolean(pageId),
    graphVersion,
    pageId: pageId ?? null,
    configured: Boolean(token && pageId),
  }
}

function conversationMarker(conversationId: string): string {
  return `FB_CONVERSATION_ID:${conversationId}`
}

function normalizeForNameMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function extractAssignedNameFromMessage(message: string): string | null {
  const normalized = message.trim()
  if (!normalized) return null

  const patterns = [
    /assigned\s+this\s+conversation\s+to\s+([^\.\n\r]+)/i,
    /assigned\s+to\s+([^\.\n\r]+)/i,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    const candidate = match?.[1]?.trim()
    if (candidate && candidate.length > 1) {
      return candidate
    }
  }

  return null
}

function extractPhoneFromMessage(message: string): string | null {
  if (!message.trim()) return null

  const matches = message.match(/(?:\+?\d[\d\s()\-]{8,}\d)/g) ?? []
  for (const raw of matches) {
    const compact = raw.replace(/[\s()\-]/g, '')

    // Bangladesh international format: +8801XXXXXXXXX
    if (compact.startsWith('+880')) {
      const localCore = compact.slice(4)
      if (/^1[3-9]\d{8}$/.test(localCore)) {
        return `+880${localCore}`
      }
      continue
    }

    // Bangladesh international format without plus: 8801XXXXXXXXX
    if (compact.startsWith('880')) {
      const localCore = compact.slice(3)
      if (/^1[3-9]\d{8}$/.test(localCore)) {
        return `+880${localCore}`
      }
      continue
    }

    // Bangladesh local format: 01XXXXXXXXX
    if (/^01[3-9]\d{8}$/.test(compact)) {
      return compact
    }
  }

  return null
}

function getConversationMessages(conversation: FacebookConversation): string[] {
  return (conversation.messages?.data ?? [])
    .map((item) => item.message?.trim() ?? '')
    .filter((item) => item.length > 0)
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const { token, graphVersion } = getFacebookConfig()
  if (!token) {
    console.warn(`${FB_LOG_PREFIX} graph_get aborted reason=missing_access_token path=${path}`)
    throw new Error('FB_PAGE_ACCESS_TOKEN is missing')
  }

  const query = new URLSearchParams({
    ...params,
    access_token: token,
  })
  const url = `https://graph.facebook.com/${graphVersion}${path}?${query.toString()}`
  console.info(
    `${FB_LOG_PREFIX} graph_get start path=${path} graph_version=${graphVersion} param_keys=${Object.keys(params).join(',')}`,
  )

  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    const errorText = await response.text()
    console.error(
      `${FB_LOG_PREFIX} graph_get failed path=${path} status=${response.status} error=${errorText}`,
    )
    throw new Error(`Facebook Graph API error (${response.status}): ${errorText}`)
  }

  console.info(`${FB_LOG_PREFIX} graph_get success path=${path} status=${response.status}`)
  return (await response.json()) as T
}

export async function fetchRecentFacebookConversations(limit = FB_DEFAULT_LIMIT): Promise<FacebookConversation[]> {
  const page = await fetchFacebookConversationPage({ limit })
  return page.conversations
}

export async function fetchFacebookConversationPage(
  options: FetchFacebookConversationPageOptions = {},
): Promise<FetchFacebookConversationPageResult> {
  const { pageId } = getFacebookConfig()
  if (!pageId) {
    console.warn(`${FB_LOG_PREFIX} fetch_conversations aborted reason=missing_page_id`)
    throw new Error('FB_PAGE_ID is missing')
  }

  const limit = options.limit ?? FB_DEFAULT_LIMIT
  const afterCursor = options.afterCursor?.trim() || null
  console.info(
    `${FB_LOG_PREFIX} fetch_conversations start page_id=${pageId} limit=${limit} after_cursor=${afterCursor ?? 'null'}`,
  )

  const payload = await graphGet<FacebookConversationResponse>(`/${pageId}/conversations`, {
    fields:
      'id,updated_time,participants.limit(10){id,name},messages.limit(10){id,message,created_time,from{id,name}}',
    limit: String(limit),
    ...(afterCursor ? { after: afterCursor } : {}),
  })

  const conversations = Array.isArray(payload.data) ? payload.data : []
  const nextCursor = payload.paging?.next ? payload.paging?.cursors?.after ?? null : null
  console.info(
    `${FB_LOG_PREFIX} fetch_conversations success count=${conversations.length} next_cursor=${nextCursor ?? 'null'}`,
  )
  return { conversations, nextCursor }
}

export async function checkFacebookGraphConnection() {
  const { pageId } = getFacebookConfig()
  console.info(`${FB_LOG_PREFIX} graph_connection_check start page_id_configured=${Boolean(pageId)}`)
  if (!pageId) {
    console.warn(`${FB_LOG_PREFIX} graph_connection_check failed reason=missing_page_id`)
    return {
      ok: false as const,
      error: 'FB_PAGE_ID is missing',
    }
  }

  try {
    const page = await graphGet<FacebookPageProfile>(`/${pageId}`, {
      fields: 'id,name',
    })
    const conversations = await fetchRecentFacebookConversations(3)
    console.info(
      `${FB_LOG_PREFIX} graph_connection_check success page_id=${page.id ?? pageId} page_name=${page.name ?? 'null'} sample_count=${conversations.length}`,
    )
    return {
      ok: true as const,
      pageId: page.id ?? pageId,
      pageName: page.name ?? null,
      sampleConversationCount: conversations.length,
    }
  } catch (error) {
    console.error(`${FB_LOG_PREFIX} graph_connection_check failed:`, error)
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Unknown Graph API error',
    }
  }
}

function extractCustomerName(conversation: FacebookConversation, pageId: string): string | null {
  const participants = conversation.participants?.data ?? []
  const customer = participants.find((participant) => participant.id && participant.id !== pageId)
  const normalized = customer?.name?.trim()
  return normalized && normalized.length > 0 ? normalized : null
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

function findAgentByAssignedMessages(agents: JrCrmAgent[], messages: string[]): JrCrmAgent | null {
  for (const message of messages) {
    const assignedName = extractAssignedNameFromMessage(message)
    if (!assignedName) continue

    const normalizedAssignedName = normalizeForNameMatch(assignedName)
    if (!normalizedAssignedName) continue

    for (const agent of agents) {
      const normalizedAgentName = normalizeForNameMatch(agent.fullName)
      if (!normalizedAgentName) continue

      if (
        normalizedAssignedName === normalizedAgentName ||
        normalizedAssignedName.includes(normalizedAgentName) ||
        normalizedAgentName.includes(normalizedAssignedName)
      ) {
        return agent
      }
    }
  }

  return null
}

function extractPhoneFromMessages(messages: string[]): string | null {
  for (const message of messages) {
    const phone = extractPhoneFromMessage(message)
    if (phone) return phone
  }
  return null
}

async function importConversationToLead(
  conversation: FacebookConversation,
  pageId: string,
  options: {
    jrCrmAgents: JrCrmAgent[]
    jrCrmRoundRobinOffset: number
  },
): Promise<{
  created: boolean
  usedRoundRobin: boolean
}> {
  if (!conversation.id) {
    return { created: false, usedRoundRobin: false }
  }

  const messages = getConversationMessages(conversation)
  const lastMessage = messages[0] ?? ''
  const detectedAgent = findAgentByAssignedMessages(options.jrCrmAgents, messages)
  const detectedPhone = extractPhoneFromMessages(messages)

  const marker = conversationMarker(conversation.id)
  const existing = await prisma.lead.findFirst({
    where: {
      source: { equals: 'Facebook', mode: 'insensitive' },
      remarks: { contains: marker },
    },
    select: { id: true, phone: true, assignedTo: true },
  })

  if (existing) {
    const updates: {
      phone?: string
      stage?: LeadStage
      assignedTo?: string
    } = {}

    if (detectedPhone && !existing.phone) {
      const existingByPhone = await prisma.lead.findFirst({
        where: {
          phone: detectedPhone,
          id: { not: existing.id },
        },
        select: { id: true },
      })

      if (!existingByPhone) {
        updates.phone = detectedPhone
        updates.stage = LeadStage.NUMBER_COLLECTED
      }
    }

    if (detectedAgent && existing.assignedTo !== detectedAgent.id) {
      updates.assignedTo = detectedAgent.id
    }

    if (Object.keys(updates).length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.lead.update({
          where: { id: existing.id },
          data: updates,
        })

        if (detectedAgent) {
          await tx.leadAssignment.createMany({
            data: [
              {
                leadId: existing.id,
                userId: detectedAgent.id,
                department: LeadAssignmentDepartment.JR_CRM,
              },
            ],
            skipDuplicates: true,
          })
        }
      })
    }

    return { created: false, usedRoundRobin: false }
  }

  const customerName =
    extractCustomerName(conversation, pageId) ??
    `Facebook User ${conversation.id.slice(-6)}`

  let assignee: JrCrmAgent | null = detectedAgent
  let usedRoundRobin = false

  if (!detectedPhone) {
    return { created: false, usedRoundRobin: false }
  }

  if (!assignee && options.jrCrmAgents.length > 0) {
    const index = options.jrCrmRoundRobinOffset % options.jrCrmAgents.length
    assignee = options.jrCrmAgents[index]
    usedRoundRobin = true
  }

  const existingByPhone = await prisma.lead.findFirst({
    where: { phone: detectedPhone },
    select: { id: true },
  })
  if (existingByPhone) {
    return { created: false, usedRoundRobin: false }
  }

  const leadPhone: string = detectedPhone
  const stage: LeadStage = LeadStage.NUMBER_COLLECTED

  const assignmentFromMessage = detectedAgent ? `\nAssigned by Meta message to: ${detectedAgent.fullName}` : ''
  const phoneMarker = `\nDetected phone: ${leadPhone}`

  await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        name: customerName,
        source: 'Facebook',
        phone: leadPhone,
        stage,
        assignedTo: assignee?.id ?? null,
        remarks: lastMessage
          ? `${marker}\nImported from Facebook.\nLast message: ${lastMessage}${assignmentFromMessage}${phoneMarker}`
          : `${marker}\nImported from Facebook conversation.${assignmentFromMessage}${phoneMarker}`,
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
          description: `Lead "${customerName}" was created from Facebook chat.`,
        },
      })
    }
  })

  return {
    created: true,
    usedRoundRobin,
  }
}

export async function syncRecentFacebookConversationsToLeads(
  options: SyncFacebookOptions = {},
): Promise<SyncFacebookResult> {
  const result = await syncFacebookConversationsIncremental({
    limit: options.limit,
    afterCursor: null,
    watermarkIso: null,
    jrCrmRoundRobinOffset: 0,
  })

  return {
    fetchedConversations: result.fetchedConversations,
    createdLeads: result.createdLeads,
  }
}

export async function syncFacebookConversationsIncremental(
  options: SyncFacebookIncrementalOptions = {},
): Promise<SyncFacebookIncrementalResult> {
  const { pageId } = getFacebookConfig()
  const limit = options.limit ?? FB_DEFAULT_LIMIT
  const afterCursor = options.afterCursor?.trim() || null
  const watermark = options.watermarkIso ? new Date(options.watermarkIso) : null
  const watermarkMs = watermark && !Number.isNaN(watermark.getTime()) ? watermark.getTime() : null
  const jrCrmAgents = await getActiveJrCrmAgents()
  let jrCrmRoundRobinOffset = Math.max(0, options.jrCrmRoundRobinOffset ?? 0)

  console.info(
    `${FB_LOG_PREFIX} sync_incremental start page_id_configured=${Boolean(pageId)} config_ok=${isFacebookConfigured()} limit=${limit} after_cursor=${afterCursor ?? 'null'} watermark=${options.watermarkIso ?? 'null'} jr_agents=${jrCrmAgents.length} rr_offset=${jrCrmRoundRobinOffset}`,
  )

  if (!pageId || !isFacebookConfigured()) {
    console.warn(`${FB_LOG_PREFIX} sync_incremental skipped reason=incomplete_config`)
    return {
      fetchedConversations: 0,
      createdLeads: 0,
      nextCursor: null,
      maxUpdatedTimeIso: options.watermarkIso ?? null,
      nextJrCrmRoundRobinOffset: jrCrmRoundRobinOffset,
    }
  }

  const { conversations, nextCursor } = await fetchFacebookConversationPage({ limit, afterCursor })
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

    const imported = await importConversationToLead(conversation, pageId, {
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
  console.info(
    `${FB_LOG_PREFIX} sync_incremental completed fetched=${conversations.length} created=${createdLeads} next_cursor=${nextCursor ?? 'null'} max_updated=${maxUpdatedTimeIso ?? 'null'} rr_offset=${jrCrmRoundRobinOffset}`,
  )

  return {
    fetchedConversations: conversations.length,
    createdLeads,
    nextCursor,
    maxUpdatedTimeIso,
    nextJrCrmRoundRobinOffset: jrCrmRoundRobinOffset,
  }
}
