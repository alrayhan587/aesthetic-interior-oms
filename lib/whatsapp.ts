import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

import prisma from '@/lib/prisma'
import { ActivityType, LeadAssignmentDepartment, LeadStage } from '@/generated/prisma/client'

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

type IngestResult = {
  processedMessages: number
  createdLeads: number
  skippedExistingPhone: number
  skippedNoPhone: number
}

const WHATSAPP_LOG_PREFIX = '[whatsapp-lib]'
const SETTINGS_ROW_ID = 'default'

type JrCrmAgent = {
  id: string
  fullName: string
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

function normalizePhone(value: string | undefined): string | null {
  if (!value) return null

  const hasPlus = value.trim().startsWith('+')
  const digits = value.replace(/\D/g, '')
  if (!digits) return null

  return hasPlus ? `+${digits}` : `+${digits}`
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

async function getAndAdvanceRoundRobinOffset(agentCount: number): Promise<number> {
  if (agentCount <= 0) return 0

  const control = await prisma.facebookSyncControl.upsert({
    where: { id: SETTINGS_ROW_ID },
    create: { id: SETTINGS_ROW_ID },
    update: {},
    select: { jrCrmRoundRobinOffset: true },
  })

  const selectedOffset = Math.max(0, control.jrCrmRoundRobinOffset) % agentCount
  const nextOffset = (selectedOffset + 1) % agentCount

  await prisma.facebookSyncControl.update({
    where: { id: SETTINGS_ROW_ID },
    data: { jrCrmRoundRobinOffset: nextOffset },
  })

  return selectedOffset
}

function getMessagePreview(message: WhatsAppMessage): string {
  const textBody = message.text?.body?.trim()
  if (textBody) return textBody.slice(0, 500)

  const type = message.type?.trim()
  return type ? `[${type} message]` : '[message received]'
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
  }

  if (payload.object !== 'whatsapp_business_account') {
    return result
  }

  const jrCrmAgents = await getActiveJrCrmAgents()

  for (const { message, contact } of iterIncomingMessages(payload)) {
    result.processedMessages += 1

    const rawPhone = message.from ?? contact?.wa_id
    const phone = normalizePhone(rawPhone)

    if (!phone) {
      result.skippedNoPhone += 1
      continue
    }

    const existing = await prisma.lead.findFirst({
      where: { phone },
      select: { id: true },
    })

    if (existing) {
      result.skippedExistingPhone += 1
      continue
    }

    const leadName = getLeadName(contact, phone)
    const preview = getMessagePreview(message)
    const messageId = message.id?.trim() || 'unknown'

    let assignee: JrCrmAgent | null = null
    if (jrCrmAgents.length > 0) {
      const rrOffset = await getAndAdvanceRoundRobinOffset(jrCrmAgents.length)
      assignee = jrCrmAgents[rrOffset]
    }

    await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          name: leadName,
          phone,
          source: 'WhatsApp',
          stage: LeadStage.NUMBER_COLLECTED,
          assignedTo: assignee?.id ?? null,
          remarks: `WA_MESSAGE_ID:${messageId}\nImported from WhatsApp webhook.\nLast message: ${preview}`,
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
            description: `Lead "${leadName}" was created from WhatsApp chat.`,
          },
        })
      }
    })

    result.createdLeads += 1
  }

  console.info(
    `${WHATSAPP_LOG_PREFIX} ingest complete processed=${result.processedMessages} created=${result.createdLeads} skipped_existing=${result.skippedExistingPhone} skipped_no_phone=${result.skippedNoPhone}`,
  )

  return result
}
