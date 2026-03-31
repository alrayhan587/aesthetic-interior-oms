import 'server-only'

import prisma from '@/lib/prisma'
import { isFacebookConfigured, syncFacebookConversationsIncremental } from '@/lib/facebook'

const SETTINGS_ROW_ID = 'default'
const SYNC_LOCK_ID = 92738165

export type FacebookSyncTrigger = 'MANUAL' | 'SCHEDULED_FALLBACK'

export type FacebookSyncControlState = {
  enabled: boolean
  fallbackEnabled: boolean
  fallbackIntervalMinutes: number
  batchLimit: number
  lastSyncAt: string | null
  lastSyncStatus: string | null
  lastSyncFetched: number | null
  lastSyncCreated: number | null
  lastSyncError: string | null
  lastSyncTrigger: string | null
  incrementalCursor: string | null
  incrementalWatermark: string | null
  jrCrmRoundRobinOffset: number
  nextScheduledAt: string | null
}

type UpdateFacebookSyncControlInput = {
  enabled?: boolean
  fallbackEnabled?: boolean
  fallbackIntervalMinutes?: number
  batchLimit?: number
}

type RunFacebookSyncResult = {
  ran: boolean
  reason?: string
  fetchedConversations?: number
  createdLeads?: number
  nextCursor?: string | null
  watermarkIso?: string | null
}

function clampIntervalMinutes(value: number): number {
  if (!Number.isFinite(value)) return 15
  return Math.min(Math.max(Math.round(value), 5), 24 * 60)
}

function clampBatchLimit(value: number): number {
  if (!Number.isFinite(value)) return 20
  return Math.min(Math.max(Math.round(value), 5), 100)
}

function serializeControlRow(row: {
  enabled: boolean
  fallbackEnabled: boolean
  fallbackIntervalMinutes: number
  batchLimit: number
  lastSyncAt: Date | null
  lastSyncStatus: string | null
  lastSyncFetched: number | null
  lastSyncCreated: number | null
  lastSyncError: string | null
  lastSyncTrigger: string | null
  incrementalCursor: string | null
  incrementalWatermark: Date | null
  jrCrmRoundRobinOffset: number
}): FacebookSyncControlState {
  const nextScheduledAt =
    row.fallbackEnabled && row.lastSyncAt
      ? new Date(row.lastSyncAt.getTime() + row.fallbackIntervalMinutes * 60_000).toISOString()
      : null

  return {
    enabled: row.enabled,
    fallbackEnabled: row.fallbackEnabled,
    fallbackIntervalMinutes: row.fallbackIntervalMinutes,
    batchLimit: row.batchLimit,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    lastSyncStatus: row.lastSyncStatus,
    lastSyncFetched: row.lastSyncFetched,
    lastSyncCreated: row.lastSyncCreated,
    lastSyncError: row.lastSyncError,
    lastSyncTrigger: row.lastSyncTrigger,
    incrementalCursor: row.incrementalCursor,
    incrementalWatermark: row.incrementalWatermark?.toISOString() ?? null,
    jrCrmRoundRobinOffset: row.jrCrmRoundRobinOffset,
    nextScheduledAt,
  }
}

async function ensureControlRow() {
  return prisma.facebookSyncControl.upsert({
    where: { id: SETTINGS_ROW_ID },
    create: {
      id: SETTINGS_ROW_ID,
      enabled: true,
      fallbackEnabled: true,
      fallbackIntervalMinutes: 15,
      batchLimit: 20,
    },
    update: {},
  })
}

async function tryAcquireSyncLock(): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ locked: boolean }>>`
    SELECT pg_try_advisory_lock(${SYNC_LOCK_ID}) AS locked
  `
  return Boolean(rows[0]?.locked)
}

async function releaseSyncLock() {
  await prisma.$queryRaw`
    SELECT pg_advisory_unlock(${SYNC_LOCK_ID})
  `
}

export async function getFacebookSyncControlState(): Promise<FacebookSyncControlState> {
  const row = await ensureControlRow()
  return serializeControlRow(row)
}

export async function updateFacebookSyncControlState(
  input: UpdateFacebookSyncControlInput,
): Promise<FacebookSyncControlState> {
  await ensureControlRow()

  const data: {
    enabled?: boolean
    fallbackEnabled?: boolean
    fallbackIntervalMinutes?: number
    batchLimit?: number
  } = {}

  if (typeof input.enabled === 'boolean') {
    data.enabled = input.enabled
  }

  if (typeof input.fallbackEnabled === 'boolean') {
    data.fallbackEnabled = input.fallbackEnabled
  }

  if (typeof input.fallbackIntervalMinutes === 'number') {
    data.fallbackIntervalMinutes = clampIntervalMinutes(input.fallbackIntervalMinutes)
  }

  if (typeof input.batchLimit === 'number') {
    data.batchLimit = clampBatchLimit(input.batchLimit)
  }

  const updated = await prisma.facebookSyncControl.update({
    where: { id: SETTINGS_ROW_ID },
    data,
  })

  return serializeControlRow(updated)
}

export async function recordFacebookSyncResult(input: {
  trigger: FacebookSyncTrigger
  status: 'SUCCESS' | 'FAILED'
  fetchedConversations?: number
  createdLeads?: number
  error?: string | null
  incrementalCursor?: string | null
  incrementalWatermarkIso?: string | null
  jrCrmRoundRobinOffset?: number
}) {
  await ensureControlRow()

  await prisma.facebookSyncControl.update({
    where: { id: SETTINGS_ROW_ID },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: input.status,
      lastSyncFetched: input.fetchedConversations ?? null,
      lastSyncCreated: input.createdLeads ?? null,
      lastSyncError: input.error ?? null,
      lastSyncTrigger: input.trigger,
      ...(typeof input.incrementalCursor !== 'undefined'
        ? { incrementalCursor: input.incrementalCursor }
        : {}),
      ...(typeof input.incrementalWatermarkIso !== 'undefined'
        ? {
            incrementalWatermark: input.incrementalWatermarkIso
              ? new Date(input.incrementalWatermarkIso)
              : null,
          }
        : {}),
      ...(typeof input.jrCrmRoundRobinOffset === 'number'
        ? { jrCrmRoundRobinOffset: Math.max(0, Math.floor(input.jrCrmRoundRobinOffset)) }
        : {}),
    },
  })
}

async function runIncrementalSync(trigger: FacebookSyncTrigger): Promise<RunFacebookSyncResult> {
  const settings = await ensureControlRow()

  if (!settings.enabled) {
    return { ran: false, reason: 'sync_disabled' }
  }

  if (!isFacebookConfigured()) {
    return { ran: false, reason: 'facebook_not_configured' }
  }

  const result = await syncFacebookConversationsIncremental({
    limit: settings.batchLimit,
    afterCursor: settings.incrementalCursor,
    watermarkIso: settings.incrementalWatermark?.toISOString() ?? null,
    jrCrmRoundRobinOffset: settings.jrCrmRoundRobinOffset,
  })

  await recordFacebookSyncResult({
    trigger,
    status: 'SUCCESS',
    fetchedConversations: result.fetchedConversations,
    createdLeads: result.createdLeads,
    incrementalCursor: result.nextCursor,
    incrementalWatermarkIso: result.maxUpdatedTimeIso,
    jrCrmRoundRobinOffset: result.nextJrCrmRoundRobinOffset,
  })

  return {
    ran: true,
    fetchedConversations: result.fetchedConversations,
    createdLeads: result.createdLeads,
    nextCursor: result.nextCursor,
    watermarkIso: result.maxUpdatedTimeIso,
  }
}

export async function runFacebookSyncWithControl(trigger: FacebookSyncTrigger): Promise<RunFacebookSyncResult> {
  const acquired = await tryAcquireSyncLock()
  if (!acquired) {
    return { ran: false, reason: 'sync_lock_busy' }
  }

  try {
    return await runIncrementalSync(trigger)
  } finally {
    await releaseSyncLock()
  }
}

export async function maybeRunFacebookFallbackSync(): Promise<RunFacebookSyncResult> {
  const settings = await ensureControlRow()

  if (!settings.enabled) {
    return { ran: false, reason: 'sync_disabled' }
  }

  if (!settings.fallbackEnabled) {
    return { ran: false, reason: 'fallback_disabled' }
  }

  if (!isFacebookConfigured()) {
    return { ran: false, reason: 'facebook_not_configured' }
  }

  const now = Date.now()
  if (settings.lastSyncAt) {
    const nextDueAt = settings.lastSyncAt.getTime() + settings.fallbackIntervalMinutes * 60_000
    if (now < nextDueAt) {
      return { ran: false, reason: 'not_due_yet' }
    }
  }

  const acquired = await tryAcquireSyncLock()
  if (!acquired) {
    return { ran: false, reason: 'sync_lock_busy' }
  }

  try {
    return await runIncrementalSync('SCHEDULED_FALLBACK')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync failure'
    await recordFacebookSyncResult({
      trigger: 'SCHEDULED_FALLBACK',
      status: 'FAILED',
      error: message,
    })
    throw error
  } finally {
    await releaseSyncLock()
  }
}
