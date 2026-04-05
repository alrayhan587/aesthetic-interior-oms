import 'server-only'

import prisma from '@/lib/prisma'
import { ActivityType, LeadAssignmentDepartment, LeadStage, NotificationType } from '@/generated/prisma/client'
import {
  buildPhoneLookupVariants,
  extractNormalizedPhonesSmart,
  formatPhoneForStorage,
} from '@/lib/phone-normalize'

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

type FacebookMessageResponse = {
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

export type FacebookLatestMonitorItem = {
  conversationId: string
  customerName: string
  updatedTime: string | null
  hasPhoneNumber: boolean
  detectedPhone: string | null
  selectedForImport: boolean
  selectionReason:
    | 'selected_for_import'
    | 'skipped_no_phone'
    | 'skipped_old_or_already_seen'
    | 'skipped_existing_conversation'
    | 'skipped_existing_phone'
  phoneSource: 'embedded' | 'expanded' | 'none'
}

type FacebookCreatedLeadSignal = {
  leadId: string
  leadName: string
  assignedUserId: string | null
}

type JrCrmAgent = {
  id: string
  fullName: string
}

const FB_DEFAULT_LIMIT = 20
const FB_LOG_PREFIX = '[facebook-lib]'
const FB_DEFAULT_MESSAGE_LOOKBACK_LIMIT = 50
const FB_DEFAULT_PHONE_SCAN_LIMIT = 200

export type FacebookConversationMessage = {
  id: string
  message: string
  createdAt: string
  from: {
    id: string | null
    name: string | null
  }
  senderType: 'PAGE' | 'CLIENT' | 'UNKNOWN'
}

function clampMessageLookbackLimit(value: number): number {
  if (!Number.isFinite(value)) return FB_DEFAULT_MESSAGE_LOOKBACK_LIMIT
  return Math.max(10, Math.min(100, Math.trunc(value)))
}

function getConversationMessageLookbackLimit(): number {
  const raw = Number(process.env.FB_CONVERSATION_MESSAGE_LOOKBACK_LIMIT ?? FB_DEFAULT_MESSAGE_LOOKBACK_LIMIT)
  return clampMessageLookbackLimit(raw)
}

function getConversationPhoneScanLimit(): number {
  const raw = Number(process.env.FB_CONVERSATION_PHONE_SCAN_LIMIT ?? FB_DEFAULT_PHONE_SCAN_LIMIT)
  if (!Number.isFinite(raw)) return FB_DEFAULT_PHONE_SCAN_LIMIT
  return Math.max(50, Math.min(200, Math.trunc(raw)))
}

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

function getFacebookConversationIdFromRemarksInternal(remarks: string | null | undefined): string | null {
  if (!remarks) return null
  const marker = remarks.match(/FB_CONVERSATION_ID:([a-zA-Z0-9:_-]+)/)
  const conversationId = marker?.[1]?.trim()
  return conversationId && conversationId.length > 0 ? conversationId : null
}

export function extractFacebookConversationIdFromRemarks(remarks: string | null | undefined): string | null {
  return getFacebookConversationIdFromRemarksInternal(remarks)
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
  const messageLookbackLimit = getConversationMessageLookbackLimit()
  const afterCursor = options.afterCursor?.trim() || null
  console.info(
    `${FB_LOG_PREFIX} fetch_conversations start page_id=${pageId} limit=${limit} message_lookback_limit=${messageLookbackLimit} after_cursor=${afterCursor ?? 'null'}`,
  )

  const payload = await graphGet<FacebookConversationResponse>(`/${pageId}/conversations`, {
    fields:
      `id,updated_time,participants.limit(10){id,name},messages.limit(${messageLookbackLimit}){id,message,created_time,from{id,name}}`,
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

export async function fetchFacebookConversationMessagesById(
  conversationId: string,
  limit = 50,
): Promise<FacebookConversationMessage[]> {
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 200) : 50
  const trimmedConversationId = conversationId.trim()
  if (!trimmedConversationId) return []

  const { pageId } = getFacebookConfig()
  const payload = await graphGet<FacebookMessageResponse>(`/${trimmedConversationId}/messages`, {
    fields: 'id,message,created_time,from{id,name}',
    limit: String(safeLimit),
  })

  const rows = Array.isArray(payload.data) ? payload.data : []
  return rows
    .map((item) => {
      const fromId = item.from?.id?.trim() || null
      const senderType: FacebookConversationMessage['senderType'] =
        fromId && pageId && fromId === pageId ? 'PAGE' : fromId ? 'CLIENT' : 'UNKNOWN'
      return {
        id: item.id?.trim() || `fb-msg-${Math.random().toString(36).slice(2)}`,
        message: item.message?.trim() || '',
        createdAt: item.created_time?.trim() || '',
        from: {
          id: fromId,
          name: item.from?.name?.trim() || null,
        },
        senderType,
      }
    })
    .sort((a, b) => {
      const aMs = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bMs = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return aMs - bMs
    })
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

async function extractPhoneFromConversation(
  conversation: FacebookConversation,
  options: { includeExpandedScan?: boolean } = {},
): Promise<{ phones: string[]; source: 'embedded' | 'expanded' | 'none' }> {
  const embeddedMessages = getConversationMessages(conversation)
  const embeddedPhones = extractPhonesFromMessages(embeddedMessages)
  if (embeddedPhones.length > 0) return { phones: embeddedPhones, source: 'embedded' }

  if (!conversation.id) return { phones: [], source: 'none' }
  if (options.includeExpandedScan === false) return { phones: [], source: 'none' }

  try {
    const expanded = await fetchFacebookConversationMessagesById(conversation.id, getConversationPhoneScanLimit())
    const expandedPhones = extractPhonesFromMessages(expanded.map((item) => item.message))
    if (expandedPhones.length > 0) return { phones: expandedPhones, source: 'expanded' }
  } catch (error) {
    console.warn(`${FB_LOG_PREFIX} extract_phone expanded_scan_failed conversation_id=${conversation.id}`, error)
  }

  return { phones: [], source: 'none' }
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
  signal: FacebookCreatedLeadSignal | null
}> {
  if (!conversation.id) {
    return { created: false, usedRoundRobin: false, signal: null }
  }

  const messages = getConversationMessages(conversation)
  const lastMessage = messages[0] ?? ''
  const detectedAgent = findAgentByAssignedMessages(options.jrCrmAgents, messages)
  const phoneResolution = await extractPhoneFromConversation(conversation)
  const detectedPhones = phoneResolution.phones
  const detectedPrimaryPhone = detectedPhones[0] ?? null
  const phoneLookupCandidates = buildLookupCandidatesFromPhones(detectedPhones)

  // Business rule: ignore Facebook conversations that do not contain a phone number.
  // No lead creation, no updates, no assignment/history writes for these conversations.
  if (!detectedPrimaryPhone) {
    return { created: false, usedRoundRobin: false, signal: null }
  }

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

    if (detectedPrimaryPhone && !existing.phone) {
      const existingByPhone = await prisma.lead.findFirst({
        where: {
          phone: { in: phoneLookupCandidates },
          id: { not: existing.id },
        },
        select: { id: true },
      })

      if (!existingByPhone) {
        updates.phone = formatPhoneForStorage(detectedPrimaryPhone) ?? detectedPrimaryPhone
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

    return { created: false, usedRoundRobin: false, signal: null }
  }

  const customerName =
    extractCustomerName(conversation, pageId) ??
    `Facebook User ${conversation.id.slice(-6)}`

  let assignee: JrCrmAgent | null = detectedAgent
  let usedRoundRobin = false

  if (!assignee && options.jrCrmAgents.length > 0) {
    const index = options.jrCrmRoundRobinOffset % options.jrCrmAgents.length
    assignee = options.jrCrmAgents[index]
    usedRoundRobin = true
  }

  const existingByPhone = await prisma.lead.findFirst({
    where: { phone: { in: phoneLookupCandidates } },
    select: { id: true },
  })
  if (existingByPhone) {
    return { created: false, usedRoundRobin: false, signal: null }
  }

  const leadPhone: string = formatPhoneForStorage(detectedPrimaryPhone) ?? detectedPrimaryPhone
  const stage: LeadStage = LeadStage.NUMBER_COLLECTED

  const assignmentFromMessage = detectedAgent ? `\nAssigned by Meta message to: ${detectedAgent.fullName}` : ''
  const phoneMarker = `\nDetected phones: ${detectedPhones.map((item) => formatPhoneForStorage(item) ?? item).join(', ')}`

  const createdLead = await prisma.$transaction(async (tx) => {
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

    return {
      id: lead.id,
      name: customerName,
      assignedUserId: assignee?.id ?? null,
    }
  })

  return {
    created: true,
    usedRoundRobin,
    signal: {
      leadId: createdLead.id,
      leadName: createdLead.name,
      assignedUserId: createdLead.assignedUserId,
    },
  }
}

async function createLeadSyncNotifications(signals: FacebookCreatedLeadSignal[]) {
  if (signals.length === 0) return

  const assignedCountByUser = new Map<string, number>()
  for (const signal of signals) {
    if (!signal.assignedUserId) continue
    assignedCountByUser.set(signal.assignedUserId, (assignedCountByUser.get(signal.assignedUserId) ?? 0) + 1)
  }

  const adminUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      userDepartments: {
        some: {
          department: {
            name: 'ADMIN',
          },
        },
      },
    },
    select: { id: true },
  })

  const now = new Date()
  const assignedTotal = Array.from(assignedCountByUser.values()).reduce((sum, value) => sum + value, 0)
  const adminNotificationData = adminUsers.map((admin) => ({
    userId: admin.id,
    type: NotificationType.FACEBOOK_LEAD_SYNC_SUMMARY,
    title: 'Facebook leads synced',
    message: `${signals.length} new lead${signals.length === 1 ? '' : 's'} created from Facebook, ${assignedTotal} assigned to JR CRM.`,
    scheduledFor: now,
  }))

  const jrNotificationData = Array.from(assignedCountByUser.entries()).map(([userId, count]) => ({
    userId,
    type: NotificationType.LEAD_ASSIGNED_TO_YOU,
    title: 'New Facebook leads assigned',
    message: `You are assigned ${count} new Facebook lead${count === 1 ? '' : 's'}.`,
    scheduledFor: now,
  }))

  const fallbackLeadId = signals[0]?.leadId ?? null

  await prisma.notification.createMany({
    data: adminNotificationData.map((item) => ({
      ...item,
      leadId: fallbackLeadId,
    })),
  })
  await prisma.notification.createMany({
    data: jrNotificationData.map((item) => ({
      ...item,
      leadId: fallbackLeadId,
    })),
  })
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
  const newestFirstConversations = conversations
    .slice()
    .sort((a, b) => {
      const aMs = a.updated_time ? new Date(a.updated_time).getTime() : 0
      const bMs = b.updated_time ? new Date(b.updated_time).getTime() : 0
      return bMs - aMs
    })
  let createdLeads = 0
  let maxUpdatedMs = watermarkMs
  const createdSignals: FacebookCreatedLeadSignal[] = []

  for (const conversation of newestFirstConversations) {
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
      if (imported.signal) {
        createdSignals.push(imported.signal)
      }
      if (imported.usedRoundRobin && jrCrmAgents.length > 0) {
        jrCrmRoundRobinOffset = (jrCrmRoundRobinOffset + 1) % jrCrmAgents.length
      }
    }
  }

  if (createdSignals.length > 0) {
    await createLeadSyncNotifications(createdSignals)
  }

  const maxUpdatedTimeIso = maxUpdatedMs === null ? null : new Date(maxUpdatedMs).toISOString()
  console.info(
    `${FB_LOG_PREFIX} sync_incremental completed fetched=${newestFirstConversations.length} created=${createdLeads} next_cursor=${nextCursor ?? 'null'} max_updated=${maxUpdatedTimeIso ?? 'null'} rr_offset=${jrCrmRoundRobinOffset}`,
  )

  return {
    fetchedConversations: newestFirstConversations.length,
    createdLeads,
    nextCursor,
    maxUpdatedTimeIso,
    nextJrCrmRoundRobinOffset: jrCrmRoundRobinOffset,
  }
}

export async function fetchFacebookLatestMonitor(
  limit = 100,
  options: {
    fromWatermarkIso?: string | null
    toWatermarkIso?: string | null
    includeExpandedPhoneScan?: boolean
  } = {},
): Promise<FacebookLatestMonitorItem[]> {
  const { pageId } = getFacebookConfig()
  if (!pageId || !isFacebookConfigured()) {
    return []
  }

  const fromWatermark = options.fromWatermarkIso ? new Date(options.fromWatermarkIso) : null
  const toWatermark = options.toWatermarkIso ? new Date(options.toWatermarkIso) : null
  const fromWatermarkMs =
    fromWatermark && !Number.isNaN(fromWatermark.getTime()) ? fromWatermark.getTime() : null
  const toWatermarkMs =
    toWatermark && !Number.isNaN(toWatermark.getTime()) ? toWatermark.getTime() : null
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 100) : 100
  const { conversations } = await fetchFacebookConversationPage({ limit: safeLimit, afterCursor: null })

  const newestFirstConversations = conversations
    .slice()
    .sort((a, b) => {
      const aMs = a.updated_time ? new Date(a.updated_time).getTime() : 0
      const bMs = b.updated_time ? new Date(b.updated_time).getTime() : 0
      return bMs - aMs
    })
    .slice(0, safeLimit)

  const rows: FacebookLatestMonitorItem[] = []
  for (const conversation of newestFirstConversations) {
    const phoneResolution = await extractPhoneFromConversation(conversation, {
      includeExpandedScan: options.includeExpandedPhoneScan ?? false,
    })
    const detectedPhones = phoneResolution.phones
    const detectedPrimaryPhone = detectedPhones[0] ?? null
    const customerName =
      extractCustomerName(conversation, pageId) ??
      `Facebook User ${conversation.id?.slice(-6) ?? 'unknown'}`

    const updatedMs = conversation.updated_time ? new Date(conversation.updated_time).getTime() : null
    const isValidUpdatedMs = updatedMs !== null && !Number.isNaN(updatedMs)
    const isAfterFromWatermark =
      fromWatermarkMs === null || (isValidUpdatedMs && updatedMs > fromWatermarkMs)
    const isBeforeOrAtToWatermark =
      toWatermarkMs === null || (isValidUpdatedMs && updatedMs <= toWatermarkMs)
    const isInLastFetchedWindow = isAfterFromWatermark && isBeforeOrAtToWatermark

    let selectionReason: FacebookLatestMonitorItem['selectionReason'] = 'selected_for_import'
    let selectedForImport = true

    if (!detectedPrimaryPhone) {
      selectionReason = 'skipped_no_phone'
      selectedForImport = false
    } else if (!isInLastFetchedWindow) {
      selectionReason = 'skipped_old_or_already_seen'
      selectedForImport = false
    }

    rows.push({
      conversationId: conversation.id,
      customerName,
      updatedTime: conversation.updated_time ?? null,
      hasPhoneNumber: Boolean(detectedPrimaryPhone),
      detectedPhone: detectedPrimaryPhone ? formatPhoneForStorage(detectedPrimaryPhone) ?? detectedPrimaryPhone : null,
      selectedForImport,
      selectionReason,
      phoneSource: phoneResolution.source,
    })
  }

  return rows
}
