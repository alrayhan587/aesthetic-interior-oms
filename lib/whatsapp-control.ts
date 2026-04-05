import 'server-only'

import prisma from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'

const SETTINGS_ROW_ID = 'default'

type ControlRow = {
  enabled: boolean
  lastWebhookAt: Date | null
  lastWebhookStatus: string | null
  lastWebhookError: string | null
  lastProcessedMessages: number
  lastCreatedLeads: number
  lastSkippedExistingPhone: number
  lastSkippedNoPhone: number
  lastSkippedDuplicateMessage: number
  totalWebhookEvents: number
  totalProcessedMessages: number
  totalCreatedLeads: number
  totalSkippedExistingPhone: number
  totalSkippedNoPhone: number
  totalSkippedDuplicateMessage: number
  jrCrmRoundRobinOffset: number
  createdAt: Date
  updatedAt: Date
}

export type WhatsAppControlState = {
  enabled: boolean
  lastWebhookAt: string | null
  lastWebhookStatus: string | null
  lastWebhookError: string | null
  lastProcessedMessages: number
  lastCreatedLeads: number
  lastSkippedExistingPhone: number
  lastSkippedNoPhone: number
  lastSkippedDuplicateMessage: number
  totalWebhookEvents: number
  totalProcessedMessages: number
  totalCreatedLeads: number
  totalSkippedExistingPhone: number
  totalSkippedNoPhone: number
  totalSkippedDuplicateMessage: number
  jrCrmRoundRobinOffset: number
  createdAt: string
  updatedAt: string
}

export type WhatsAppRecordResultInput = {
  processedMessages: number
  createdLeads: number
  skippedExistingPhone: number
  skippedNoPhone: number
  skippedDuplicateMessage: number
  source?: 'META' | 'WAWP' | 'UNKNOWN'
}

export type WhatsAppWebhookEventLog = {
  id: string
  status: string
  source: string | null
  processedMessages: number
  createdLeads: number
  skippedExistingPhone: number
  skippedNoPhone: number
  skippedDuplicateMessage: number
  error: string | null
  createdAt: string
}

function getWebhookEventDelegate():
  | {
      create: (args: {
        data: {
          status: string
          source?: string | null
          processedMessages?: number
          createdLeads?: number
          skippedExistingPhone?: number
          skippedNoPhone?: number
          skippedDuplicateMessage?: number
          error?: string | null
        }
      }) => Promise<unknown>
      findMany: (args: {
        orderBy: { createdAt: 'desc' }
        take: number
      }) => Promise<Array<{
        id: string
        status: string
        source: string | null
        processedMessages: number
        createdLeads: number
        skippedExistingPhone: number
        skippedNoPhone: number
        skippedDuplicateMessage: number
        error: string | null
        createdAt: Date
      }>>
    }
  | null {
  const candidate = (prisma as unknown as { whatsAppWebhookEvent?: unknown }).whatsAppWebhookEvent
  if (!candidate || typeof candidate !== 'object') return null

  const record = candidate as {
    create?: unknown
    findMany?: unknown
  }
  if (typeof record.create !== 'function' || typeof record.findMany !== 'function') return null
  return record as ReturnType<typeof getWebhookEventDelegate> extends infer T ? Exclude<T, null> : never
}

function serialize(row: ControlRow): WhatsAppControlState {
  return {
    enabled: row.enabled,
    lastWebhookAt: row.lastWebhookAt?.toISOString() ?? null,
    lastWebhookStatus: row.lastWebhookStatus,
    lastWebhookError: row.lastWebhookError,
    lastProcessedMessages: row.lastProcessedMessages,
    lastCreatedLeads: row.lastCreatedLeads,
    lastSkippedExistingPhone: row.lastSkippedExistingPhone,
    lastSkippedNoPhone: row.lastSkippedNoPhone,
    lastSkippedDuplicateMessage: row.lastSkippedDuplicateMessage,
    totalWebhookEvents: row.totalWebhookEvents,
    totalProcessedMessages: row.totalProcessedMessages,
    totalCreatedLeads: row.totalCreatedLeads,
    totalSkippedExistingPhone: row.totalSkippedExistingPhone,
    totalSkippedNoPhone: row.totalSkippedNoPhone,
    totalSkippedDuplicateMessage: row.totalSkippedDuplicateMessage,
    jrCrmRoundRobinOffset: row.jrCrmRoundRobinOffset,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function ensureWhatsAppControlRow() {
  return prisma.whatsAppWebhookControl.upsert({
    where: { id: SETTINGS_ROW_ID },
    create: { id: SETTINGS_ROW_ID, enabled: true },
    update: {},
  })
}

export async function getWhatsAppControlState(): Promise<WhatsAppControlState> {
  const row = await ensureWhatsAppControlRow()
  return serialize(row)
}

export async function setWhatsAppEnabled(enabled: boolean): Promise<WhatsAppControlState> {
  await ensureWhatsAppControlRow()
  const row = await prisma.whatsAppWebhookControl.update({
    where: { id: SETTINGS_ROW_ID },
    data: { enabled },
  })
  return serialize(row)
}

export async function recordWhatsAppWebhookResult(input: WhatsAppRecordResultInput): Promise<void> {
  await ensureWhatsAppControlRow()
  await prisma.whatsAppWebhookControl.update({
    where: { id: SETTINGS_ROW_ID },
    data: {
      lastWebhookAt: new Date(),
      lastWebhookStatus: 'SUCCESS',
      lastWebhookError: null,
      lastProcessedMessages: input.processedMessages,
      lastCreatedLeads: input.createdLeads,
      lastSkippedExistingPhone: input.skippedExistingPhone,
      lastSkippedNoPhone: input.skippedNoPhone,
      lastSkippedDuplicateMessage: input.skippedDuplicateMessage,
      totalWebhookEvents: { increment: 1 },
      totalProcessedMessages: { increment: input.processedMessages },
      totalCreatedLeads: { increment: input.createdLeads },
      totalSkippedExistingPhone: { increment: input.skippedExistingPhone },
      totalSkippedNoPhone: { increment: input.skippedNoPhone },
      totalSkippedDuplicateMessage: { increment: input.skippedDuplicateMessage },
    },
  })

  const delegate = getWebhookEventDelegate()
  if (!delegate) return

  try {
    await delegate.create({
      data: {
        status: 'SUCCESS',
        source: input.source ?? null,
        processedMessages: input.processedMessages,
        createdLeads: input.createdLeads,
        skippedExistingPhone: input.skippedExistingPhone,
        skippedNoPhone: input.skippedNoPhone,
        skippedDuplicateMessage: input.skippedDuplicateMessage,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      return
    }
    throw error
  }
}

export async function recordWhatsAppWebhookError(
  errorMessage: string,
  source: 'META' | 'WAWP' | 'UNKNOWN' = 'UNKNOWN',
): Promise<void> {
  await ensureWhatsAppControlRow()
  await prisma.whatsAppWebhookControl.update({
    where: { id: SETTINGS_ROW_ID },
    data: {
      lastWebhookAt: new Date(),
      lastWebhookStatus: 'FAILED',
      lastWebhookError: errorMessage.slice(0, 2000),
      totalWebhookEvents: { increment: 1 },
    },
  })

  const delegate = getWebhookEventDelegate()
  if (!delegate) return

  try {
    await delegate.create({
      data: {
        status: 'FAILED',
        source,
        error: errorMessage.slice(0, 2000),
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      return
    }
    throw error
  }
}

export async function getRecentWhatsAppWebhookEvents(limit = 20): Promise<WhatsAppWebhookEventLog[]> {
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 100) : 20
  const delegate = getWebhookEventDelegate()
  if (!delegate) return []
  let rows: Awaited<ReturnType<typeof delegate.findMany>>
  try {
    rows = await delegate.findMany({
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      return []
    }
    throw error
  }

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    source: row.source,
    processedMessages: row.processedMessages,
    createdLeads: row.createdLeads,
    skippedExistingPhone: row.skippedExistingPhone,
    skippedNoPhone: row.skippedNoPhone,
    skippedDuplicateMessage: row.skippedDuplicateMessage,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
  }))
}

export async function getAndAdvanceWhatsAppRoundRobinOffset(agentCount: number): Promise<number> {
  if (agentCount <= 0) return 0

  const control = await ensureWhatsAppControlRow()
  const selectedOffset = Math.max(0, control.jrCrmRoundRobinOffset) % agentCount
  const nextOffset = (selectedOffset + 1) % agentCount

  await prisma.whatsAppWebhookControl.update({
    where: { id: SETTINGS_ROW_ID },
    data: { jrCrmRoundRobinOffset: nextOffset },
  })

  return selectedOffset
}
