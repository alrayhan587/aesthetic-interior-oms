import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

import prisma from '@/lib/prisma'
import { ActivityType, LeadAssignmentDepartment, LeadStage, NotificationType } from '@/generated/prisma/client'
import { getAndAdvanceWhatsAppRoundRobinOffset } from '@/lib/whatsapp-control'
import { Prisma } from '@/generated/prisma/client'
import {
  buildPhoneLookupVariants,
  extractNormalizedPhonesSmart,
  formatPhoneForStorage,
  normalizePhoneSmart,
} from '@/lib/phone-normalize'

type WhatsAppContact = {
  wa_id?: string
  profile?: {
    name?: string
  }
}

type WhatsAppMessage = {
  id?: string
  from?: string
  timestamp?: string
  type?: string
  text?: {
    body?: string
  }
}

type WhatsAppChangeValue = {
  contacts?: WhatsAppContact[]
  messages?: WhatsAppMessage[]
}

type WhatsAppWebhookPayload = {
  object?: string
  entry?: Array<{
    id?: string
    changes?: Array<{
      field?: string
      value?: WhatsAppChangeValue
    }>
  }>
}

type WawpMessagePayload = {
  id?: string
  from?: string
  author?: string
  participant?: string
  senderName?: string
  pushName?: string
  notifyName?: string
  fromName?: string
  sender?: {
    id?: string
    phone?: string
    number?: string
    name?: string
    pushName?: string
  }
  contact?: {
    id?: string
    phone?: string
    number?: string
    name?: string
    pushName?: string
  }
  fromMe?: boolean
  body?: string
  type?: string
}

type WawpWebhookPayload = {
  id?: string
  event?: string
  session?: string
  from?: string
  author?: string
  participant?: string
  senderName?: string
  pushName?: string
  fromName?: string
  payload?: WawpMessagePayload
}

type IngestResult = {
  processedMessages: number
  createdLeads: number
  skippedExistingPhone: number
  skippedNoPhone: number
  skippedDuplicateMessage: number
}

const WHATSAPP_LOG_PREFIX = '[whatsapp-lib]'

type JrCrmAgent = {
  id: string
  fullName: string
}

type WhatsAppCreatedLeadSignal = {
  leadId: string
  assignedUserId: string | null
}

export function getWhatsAppVerifyTokens(): string[] {
  const candidates = [
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    process.env.META_WEBHOOK_VERIFY_TOKEN,
  ]

  return candidates
    .map((value) => (value ?? '').trim())
    .filter((value, index, list) => Boolean(value) && list.indexOf(value) === index)
}

export function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET?.trim()

  // Optional in development; required in production once configured.
  if (!appSecret) {
    return true
  }

  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false
  }

  const providedSignature = signatureHeader.slice('sha256='.length)
  const expectedSignature = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')

  const providedBuffer = Buffer.from(providedSignature, 'hex')
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')

  if (providedBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(providedBuffer, expectedBuffer)
}

function normalizeWawpPhoneCandidate(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/@g\.us$/i.test(trimmed)) return null

  const fromRaw = normalizePhoneSmart(trimmed, { preferBangladesh: true })
  if (fromRaw) return fromRaw

  const atIndex = trimmed.indexOf('@')
  if (atIndex > 0) {
    const jidUser = trimmed.slice(0, atIndex)
    return normalizePhoneSmart(jidUser, { preferBangladesh: true })
  }

  return normalizePhoneSmart(trimmed, { preferBangladesh: true })
}

function getWawpPhone(payload: WawpWebhookPayload, message: WawpMessagePayload): string | null {
  const candidates = [
    message.author,
    message.participant,
    message.sender?.phone,
    message.sender?.number,
    message.sender?.id,
    message.contact?.phone,
    message.contact?.number,
    message.contact?.id,
    message.from,
    payload.author,
    payload.participant,
    payload.from,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeWawpPhoneCandidate(candidate)
    if (normalized) return normalized
  }

  return null
}

function getWawpLeadName(payload: WawpWebhookPayload, message: WawpMessagePayload, phone: string): string {
  const nameCandidates = [
    message.pushName,
    message.notifyName,
    message.senderName,
    message.fromName,
    message.sender?.name,
    message.sender?.pushName,
    message.contact?.name,
    message.contact?.pushName,
    payload.pushName,
    payload.senderName,
    payload.fromName,
  ]

  for (const candidate of nameCandidates) {
    const normalized = typeof candidate === 'string' ? candidate.trim() : ''
    if (normalized) return normalized
  }

  return `WhatsApp User ${phone.slice(-6)}`
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

async function createLeadSyncNotifications(signals: WhatsAppCreatedLeadSignal[]) {
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
  const fallbackLeadId = signals[0]?.leadId ?? null

  const adminNotificationData = adminUsers.map((admin) => ({
    userId: admin.id,
    type: NotificationType.FACEBOOK_LEAD_SYNC_SUMMARY,
    title: 'WhatsApp leads synced',
    message: `${signals.length} new lead${signals.length === 1 ? '' : 's'} created from WhatsApp, ${assignedTotal} assigned to JR CRM.`,
    scheduledFor: now,
    leadId: fallbackLeadId,
  }))

  const jrNotificationData = Array.from(assignedCountByUser.entries()).map(([userId, count]) => ({
    userId,
    type: NotificationType.LEAD_ASSIGNED_TO_YOU,
    title: 'New WhatsApp leads assigned',
    message: `You are assigned ${count} new WhatsApp lead${count === 1 ? '' : 's'}.`,
    scheduledFor: now,
    leadId: fallbackLeadId,
  }))

  if (adminNotificationData.length > 0) {
    await prisma.notification.createMany({ data: adminNotificationData })
  }
  if (jrNotificationData.length > 0) {
    await prisma.notification.createMany({ data: jrNotificationData })
  }
}

function getMessagePreview(message: WhatsAppMessage): string {
  const textBody = message.text?.body?.trim()
  if (textBody) return textBody.slice(0, 500)

  const type = message.type?.trim()
  return type ? `[${type} message]` : '[message received]'
}

function extractPhonesFromTextBody(body: string | null | undefined): string[] {
  if (!body) return []
  return extractNormalizedPhonesSmart(body, { preferBangladesh: true })
}

function getLeadName(contact: WhatsAppContact | undefined, normalizedPhone: string): string {
  const contactName = contact?.profile?.name?.trim()
  if (contactName) return contactName
  return `WhatsApp User ${normalizedPhone.slice(-6)}`
}

function* iterIncomingMessages(payload: WhatsAppWebhookPayload): Generator<{
  message: WhatsAppMessage
  contact: WhatsAppContact | undefined
}> {
  const entries = Array.isArray(payload.entry) ? payload.entry : []

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : []

    for (const change of changes) {
      if (change.field && change.field !== 'messages') continue

      const value = change.value
      if (!value) continue

      const contacts = Array.isArray(value.contacts) ? value.contacts : []
      const messages = Array.isArray(value.messages) ? value.messages : []
      const contactsByWaId = new Map(
        contacts
          .filter((contact) => typeof contact?.wa_id === 'string' && contact.wa_id.trim().length > 0)
          .map((contact) => [contact.wa_id!.trim(), contact]),
      )

      for (const message of messages) {
        const messageFrom = message.from?.trim()
        const contact = messageFrom ? contactsByWaId.get(messageFrom) : undefined
        yield { message, contact }
      }
    }
  }
}

export async function ingestWhatsAppWebhook(payload: WhatsAppWebhookPayload): Promise<IngestResult> {
  const result: IngestResult = {
    processedMessages: 0,
    createdLeads: 0,
    skippedExistingPhone: 0,
    skippedNoPhone: 0,
    skippedDuplicateMessage: 0,
  }

  if (payload.object !== 'whatsapp_business_account') {
    return result
  }

  const jrCrmAgents = await getActiveJrCrmAgents()

  const createdSignals: WhatsAppCreatedLeadSignal[] = []

  for (const { message, contact } of iterIncomingMessages(payload)) {
    result.processedMessages += 1
    const messageId = message.id?.trim()

    if (!messageId) {
      result.skippedDuplicateMessage += 1
      continue
    }

    const rawPhone = message.from ?? contact?.wa_id
    const phone = normalizePhoneSmart(rawPhone, { preferBangladesh: true })

    if (!phone) {
      result.skippedNoPhone += 1
      continue
    }
    const phoneLookupCandidates = buildPhoneLookupVariants(phone)
    const storedPrimaryPhone = formatPhoneForStorage(phone) ?? phone
    const detectedFromBody = extractPhonesFromTextBody(message.text?.body)
    const detectedPhones = Array.from(
      new Set([phone, ...detectedFromBody].map((item) => formatPhoneForStorage(item) ?? item)),
    )

    const leadName = getLeadName(contact, phone)
    const preview = getMessagePreview(message)

    let assignee: JrCrmAgent | null = null
    if (jrCrmAgents.length > 0) {
      const rrOffset = await getAndAdvanceWhatsAppRoundRobinOffset(jrCrmAgents.length)
      assignee = jrCrmAgents[rrOffset]
    }

    try {
      const created = await prisma.$transaction(async (tx) => {
        const existingMessage = await tx.whatsAppProcessedMessage.findUnique({
          where: { messageId },
          select: { id: true },
        })
        if (existingMessage) {
          return { created: false as const, reason: 'duplicate_message' as const, signal: null }
        }

        const existingLead = await tx.lead.findFirst({
          where: { phone: { in: phoneLookupCandidates } },
          select: { id: true },
        })
        if (existingLead) {
          await tx.whatsAppProcessedMessage.create({
            data: { messageId, phone: storedPrimaryPhone },
          })
          return { created: false as const, reason: 'existing_phone' as const, signal: null }
        }

        const lead = await tx.lead.create({
          data: {
            name: leadName,
            phone: storedPrimaryPhone,
            source: 'WhatsApp',
            stage: LeadStage.NUMBER_COLLECTED,
            assignedTo: assignee?.id ?? null,
            remarks: `WA_MESSAGE_ID:${messageId}\nImported from WhatsApp webhook.\nDetected phones: ${detectedPhones.join(', ')}\nLast message: ${preview}`,
          },
          select: { id: true },
        })

        await tx.whatsAppProcessedMessage.create({
          data: {
            messageId,
            phone: storedPrimaryPhone,
          },
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
              description: `Lead "${leadName}" was created from WhatsApp chat.`,
            },
          })
        }

        return {
          created: true as const,
          reason: null,
          signal: {
            leadId: lead.id,
            assignedUserId: assignee?.id ?? null,
          },
        }
      })

      if (!created.created) {
        if (created.reason === 'duplicate_message') {
          result.skippedDuplicateMessage += 1
        } else if (created.reason === 'existing_phone') {
          result.skippedExistingPhone += 1
        }
        continue
      }

      result.createdLeads += 1
      if (created.signal) {
        createdSignals.push(created.signal)
      }
    } catch (error) {
      // Handle race conditions gracefully: phone or message created by another worker.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target)
          ? error.meta?.target.join(',')
          : String(error.meta?.target ?? '')
        if (target.includes('phone')) {
          result.skippedExistingPhone += 1
        } else {
          result.skippedDuplicateMessage += 1
        }
        continue
      }
      throw error
    }
  }

  if (createdSignals.length > 0) {
    await createLeadSyncNotifications(createdSignals)
  }

  console.info(
    `${WHATSAPP_LOG_PREFIX} ingest complete processed=${result.processedMessages} created=${result.createdLeads} skipped_existing=${result.skippedExistingPhone} skipped_no_phone=${result.skippedNoPhone} skipped_duplicate_message=${result.skippedDuplicateMessage}`,
  )

  return result
}

export async function ingestWawpWebhook(payload: WawpWebhookPayload): Promise<IngestResult> {
  const result: IngestResult = {
    processedMessages: 0,
    createdLeads: 0,
    skippedExistingPhone: 0,
    skippedNoPhone: 0,
    skippedDuplicateMessage: 0,
  }

  if (payload.event !== 'message' || !payload.payload) {
    return result
  }

  result.processedMessages += 1

  const message = payload.payload
  if (message.fromMe) {
    return result
  }

  const messageId = message.id?.trim()
  if (!messageId) {
    result.skippedDuplicateMessage += 1
    return result
  }

  const phone = getWawpPhone(payload, message)
  if (!phone) {
    result.skippedNoPhone += 1
    return result
  }
  const phoneLookupCandidates = buildPhoneLookupVariants(phone)
  const storedPrimaryPhone = formatPhoneForStorage(phone) ?? phone

  const jrCrmAgents = await getActiveJrCrmAgents()
  const leadName = getWawpLeadName(payload, message, phone)
  const body = message.body?.trim()
  const preview = body && body.length > 0 ? body.slice(0, 500) : '[message received]'
  const detectedFromBody = extractPhonesFromTextBody(body)
  const detectedPhones = Array.from(
    new Set([phone, ...detectedFromBody].map((item) => formatPhoneForStorage(item) ?? item)),
  )

  let assignee: JrCrmAgent | null = null
  if (jrCrmAgents.length > 0) {
    const rrOffset = await getAndAdvanceWhatsAppRoundRobinOffset(jrCrmAgents.length)
    assignee = jrCrmAgents[rrOffset]
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const existingMessage = await tx.whatsAppProcessedMessage.findUnique({
        where: { messageId },
        select: { id: true },
      })
      if (existingMessage) {
        return { created: false as const, reason: 'duplicate_message' as const, signal: null }
      }

      const existingLead = await tx.lead.findFirst({
        where: { phone: { in: phoneLookupCandidates } },
        select: { id: true },
      })
      if (existingLead) {
        await tx.whatsAppProcessedMessage.create({
          data: { messageId, phone: storedPrimaryPhone },
        })
        return { created: false as const, reason: 'existing_phone' as const, signal: null }
      }

      const lead = await tx.lead.create({
        data: {
          name: leadName,
          phone: storedPrimaryPhone,
          source: 'WhatsApp',
          stage: LeadStage.NUMBER_COLLECTED,
          assignedTo: assignee?.id ?? null,
          remarks: `WA_MESSAGE_ID:${messageId}\nImported from WAWP webhook.\nDetected phones: ${detectedPhones.join(', ')}\nLast message: ${preview}`,
        },
        select: { id: true },
      })

      await tx.whatsAppProcessedMessage.create({
        data: {
          messageId,
          phone: storedPrimaryPhone,
        },
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
            description: `Lead "${leadName}" was created from WhatsApp chat.`,
          },
        })
      }

      return {
        created: true as const,
        reason: null,
        signal: {
          leadId: lead.id,
          assignedUserId: assignee?.id ?? null,
        },
      }
    })

    if (!created.created) {
      if (created.reason === 'duplicate_message') {
        result.skippedDuplicateMessage += 1
      } else if (created.reason === 'existing_phone') {
        result.skippedExistingPhone += 1
      }
      return result
    }

    result.createdLeads += 1
    if (created.signal) {
      await createLeadSyncNotifications([created.signal])
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target)
        ? error.meta?.target.join(',')
        : String(error.meta?.target ?? '')
      if (target.includes('phone')) {
        result.skippedExistingPhone += 1
      } else {
        result.skippedDuplicateMessage += 1
      }
      return result
    }
    throw error
  }

  return result
}
