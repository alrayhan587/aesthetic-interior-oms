import 'server-only'

import prisma from '@/lib/prisma'
import { isFacebookConfigured, syncFacebookConversationsIncremental } from '@/lib/facebook'

const SETTINGS_ROW_ID = 'default'
const SYNC_LOCK_ID = 92738165

export type FacebookSyncTrigger = 'MANUAL' | 'SCHEDULED_FALLBACK'
export type FacebookSyncLane = 'LATEST' | 'BACKFILL' | 'BOTH'

type LaneRunResult = {
  ran: boolean
  reason?: string
  fetchedConversations: number
  createdLeads: number
  nextCursor: string | null
  watermarkIso: string | null
  nextRoundRobinOffset: number
}

export type FacebookSyncControlState = {
  enabled: boolean
  latestEnabled: boolean
  latestIntervalMinutes: number
  latestBatchLimit: number
  backfillEnabled: boolean
  backfillIntervalMinutes: number
  backfillBatchLimit: number
  fallbackEnabled: boolean
  fallbackIntervalMinutes: number
  batchLimit: number
  lastSyncAt: string | null
  lastSyncStatus: string | null
  lastSyncFetched: number | null
  lastSyncCreated: number | null
  lastSyncError: string | null
  lastSyncTrigger: string | null
  lastLatestSyncAt: string | null
  lastLatestSyncStatus: string | null
  lastLatestSyncFetched: number | null
  lastLatestSyncCreated: number | null
  lastLatestSyncError: string | null
  lastBackfillSyncAt: string | null
  lastBackfillSyncStatus: string | null
  lastBackfillSyncFetched: number | null
  lastBackfillSyncCreated: number | null
  lastBackfillSyncError: string | null
  latestWatermark: string | null
  backfillCursor: string | null
  incrementalCursor: string | null
  incrementalWatermark: string | null
  jrCrmRoundRobinOffset: number
  nextScheduledAt: string | null
  nextLatestScheduledAt: string | null
  nextBackfillScheduledAt: string | null
}

type UpdateFacebookSyncControlInput = {
  enabled?: boolean
  latestEnabled?: boolean
  latestIntervalMinutes?: number
  latestBatchLimit?: number
  backfillEnabled?: boolean
  backfillIntervalMinutes?: number
  backfillBatchLimit?: number
  fallbackEnabled?: boolean
  fallbackIntervalMinutes?: number
  batchLimit?: number
}

export type RunFacebookSyncResult = {
  ran: boolean
  reason?: string
  lane: FacebookSyncLane
  fetchedConversations?: number
  createdLeads?: number
  nextCursor?: string | null
  watermarkIso?: string | null
  latest?: {
    ran: boolean
    reason?: string
    fetchedConversations: number
    createdLeads: number
    watermarkIso: string | null
  }
  backfill?: {
    ran: boolean
    reason?: string
    fetchedConversations: number
    createdLeads: number
    nextCursor: string | null
  }
}

function clampIntervalMinutes(value: number): number {
  if (!Number.isFinite(value)) return 15
  return Math.min(Math.max(Math.round(value), 1), 24 * 60)
}

function clampBatchLimit(value: number): number {
  if (!Number.isFinite(value)) return 20
  return Math.min(Math.max(Math.round(value), 5), 200)
}

function serializeControlRow(row: {
  enabled: boolean
  latestEnabled: boolean
  latestIntervalMinutes: number
  latestBatchLimit: number
  backfillEnabled: boolean
  backfillIntervalMinutes: number
  backfillBatchLimit: number
  fallbackEnabled: boolean
  fallbackIntervalMinutes: number
  batchLimit: number
  lastSyncAt: Date | null
  lastSyncStatus: string | null
  lastSyncFetched: number | null
  lastSyncCreated: number | null
  lastSyncError: string | null
  lastSyncTrigger: string | null
  lastLatestSyncAt: Date | null
  lastLatestSyncStatus: string | null
  lastLatestSyncFetched: number | null
  lastLatestSyncCreated: number | null
  lastLatestSyncError: string | null
  lastBackfillSyncAt: Date | null
  lastBackfillSyncStatus: string | null
  lastBackfillSyncFetched: number | null
  lastBackfillSyncCreated: number | null
  lastBackfillSyncError: string | null
  latestWatermark: Date | null
  backfillCursor: string | null
  incrementalCursor: string | null
  incrementalWatermark: Date | null
  jrCrmRoundRobinOffset: number
}): FacebookSyncControlState {
  const nextScheduledAt =
    row.fallbackEnabled && row.lastSyncAt
      ? new Date(row.lastSyncAt.getTime() + row.fallbackIntervalMinutes * 60_000).toISOString()
      : null
  const nextLatestScheduledAt =
    row.latestEnabled && row.lastLatestSyncAt
      ? new Date(row.lastLatestSyncAt.getTime() + row.latestIntervalMinutes * 60_000).toISOString()
      : null
  const nextBackfillScheduledAt = null

  return {
    enabled: row.enabled,
    latestEnabled: row.latestEnabled,
    latestIntervalMinutes: row.latestIntervalMinutes,
    latestBatchLimit: row.latestBatchLimit,
    backfillEnabled: row.backfillEnabled,
    backfillIntervalMinutes: row.backfillIntervalMinutes,
    backfillBatchLimit: row.backfillBatchLimit,
    fallbackEnabled: row.fallbackEnabled,
    fallbackIntervalMinutes: row.fallbackIntervalMinutes,
    batchLimit: row.batchLimit,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    lastSyncStatus: row.lastSyncStatus,
    lastSyncFetched: row.lastSyncFetched,
    lastSyncCreated: row.lastSyncCreated,
    lastSyncError: row.lastSyncError,
    lastSyncTrigger: row.lastSyncTrigger,
    lastLatestSyncAt: row.lastLatestSyncAt?.toISOString() ?? null,
    lastLatestSyncStatus: row.lastLatestSyncStatus,
    lastLatestSyncFetched: row.lastLatestSyncFetched,
    lastLatestSyncCreated: row.lastLatestSyncCreated,
    lastLatestSyncError: row.lastLatestSyncError,
    lastBackfillSyncAt: row.lastBackfillSyncAt?.toISOString() ?? null,
    lastBackfillSyncStatus: row.lastBackfillSyncStatus,
    lastBackfillSyncFetched: row.lastBackfillSyncFetched,
    lastBackfillSyncCreated: row.lastBackfillSyncCreated,
    lastBackfillSyncError: row.lastBackfillSyncError,
    latestWatermark: row.latestWatermark?.toISOString() ?? null,
    backfillCursor: row.backfillCursor,
    incrementalCursor: row.incrementalCursor,
    incrementalWatermark: row.incrementalWatermark?.toISOString() ?? null,
    jrCrmRoundRobinOffset: row.jrCrmRoundRobinOffset,
    nextScheduledAt,
    nextLatestScheduledAt,
    nextBackfillScheduledAt,
  }
}

async function ensureControlRow() {
  return prisma.facebookSyncControl.upsert({
    where: { id: SETTINGS_ROW_ID },
    create: {
      id: SETTINGS_ROW_ID,
      enabled: true,
      latestEnabled: true,
      latestIntervalMinutes: 2,
      latestBatchLimit: 20,
      backfillEnabled: false,
      backfillIntervalMinutes: 15,
      backfillBatchLimit: 20,
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
    latestEnabled?: boolean
    latestIntervalMinutes?: number
    latestBatchLimit?: number
    fallbackEnabled?: boolean
    fallbackIntervalMinutes?: number
    batchLimit?: number
  } = {}

  if (typeof input.enabled === 'boolean') data.enabled = input.enabled
  if (typeof input.latestEnabled === 'boolean') data.latestEnabled = input.latestEnabled
  if (typeof input.latestIntervalMinutes === 'number') {
    data.latestIntervalMinutes = clampIntervalMinutes(input.latestIntervalMinutes)
  }
  if (typeof input.latestBatchLimit === 'number') {
    data.latestBatchLimit = clampBatchLimit(input.latestBatchLimit)
  }

  if (typeof input.fallbackEnabled === 'boolean') data.fallbackEnabled = input.fallbackEnabled
  if (typeof input.fallbackIntervalMinutes === 'number') {
    data.fallbackIntervalMinutes = clampIntervalMinutes(input.fallbackIntervalMinutes)
  }
  if (typeof input.batchLimit === 'number') data.batchLimit = clampBatchLimit(input.batchLimit)

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
      ...(typeof input.incrementalCursor !== 'undefined' ? { incrementalCursor: input.incrementalCursor } : {}),
      ...(typeof input.incrementalWatermarkIso !== 'undefined'
        ? {
            incrementalWatermark: input.incrementalWatermarkIso ? new Date(input.incrementalWatermarkIso) : null,
          }
        : {}),
      ...(typeof input.jrCrmRoundRobinOffset === 'number'
        ? { jrCrmRoundRobinOffset: Math.max(0, Math.floor(input.jrCrmRoundRobinOffset)) }
        : {}),
    },
  })
}

async function runLatestLane(
  settings: Awaited<ReturnType<typeof ensureControlRow>>,
): Promise<LaneRunResult> {
  if (!settings.latestEnabled) {
    return {
      ran: false,
      reason: 'latest_disabled',
      fetchedConversations: 0,
      createdLeads: 0,
      nextCursor: settings.incrementalCursor ?? null,
      watermarkIso: settings.latestWatermark?.toISOString() ?? settings.incrementalWatermark?.toISOString() ?? null,
      nextRoundRobinOffset: settings.jrCrmRoundRobinOffset,
    }
  }

  const latestResult = await syncFacebookConversationsIncremental({
    limit: settings.latestBatchLimit || settings.batchLimit,
    afterCursor: null,
    watermarkIso: settings.latestWatermark?.toISOString() ?? settings.incrementalWatermark?.toISOString() ?? null,
    jrCrmRoundRobinOffset: settings.jrCrmRoundRobinOffset,
  })

  return {
    ran: true,
    fetchedConversations: latestResult.fetchedConversations,
    createdLeads: latestResult.createdLeads,
    nextCursor: latestResult.nextCursor,
    watermarkIso: latestResult.maxUpdatedTimeIso,
    nextRoundRobinOffset: latestResult.nextJrCrmRoundRobinOffset,
  }
}

async function runIncrementalSync(
  trigger: FacebookSyncTrigger,
  lane: FacebookSyncLane,
): Promise<RunFacebookSyncResult> {
  const effectiveLane: FacebookSyncLane = 'LATEST'
  const settings = await ensureControlRow()

  if (!settings.enabled) {
    return { ran: false, reason: 'sync_disabled', lane: effectiveLane }
  }

  if (!isFacebookConfigured()) {
    return { ran: false, reason: 'facebook_not_configured', lane: effectiveLane }
  }

  const latestResult = await runLatestLane(settings)

  const totalFetched = latestResult.fetchedConversations
  const totalCreated = latestResult.createdLeads
  const now = new Date()

  await prisma.facebookSyncControl.update({
    where: { id: SETTINGS_ROW_ID },
    data: {
      lastSyncAt: now,
      lastSyncStatus: 'SUCCESS',
      lastSyncFetched: totalFetched,
      lastSyncCreated: totalCreated,
      lastSyncError: null,
      lastSyncTrigger: trigger,
      ...(latestResult.ran
        ? {
            lastLatestSyncAt: now,
            lastLatestSyncStatus: 'SUCCESS',
            lastLatestSyncFetched: latestResult.fetchedConversations,
            lastLatestSyncCreated: latestResult.createdLeads,
            lastLatestSyncError: null,
            // Keep the previous watermark so monitor can display only the last fetched window.
            incrementalWatermark: settings.latestWatermark ?? settings.incrementalWatermark ?? null,
            latestWatermark: latestResult.watermarkIso ? new Date(latestResult.watermarkIso) : null,
          }
        : {}),
      jrCrmRoundRobinOffset: latestResult.nextRoundRobinOffset,
    },
  })

  if (!latestResult.ran) {
    return {
      ran: false,
      reason: latestResult.reason ?? 'latest_disabled',
      lane: effectiveLane,
      fetchedConversations: 0,
      createdLeads: 0,
      nextCursor: settings.incrementalCursor ?? null,
      watermarkIso: latestResult.watermarkIso,
      latest: {
        ran: latestResult.ran,
        reason: latestResult.reason,
        fetchedConversations: latestResult.fetchedConversations,
        createdLeads: latestResult.createdLeads,
        watermarkIso: latestResult.watermarkIso,
      },
      backfill: {
        ran: false,
        reason: 'backfill_removed',
        fetchedConversations: 0,
        createdLeads: 0,
        nextCursor: null,
      },
    }
  }

  return {
    ran: true,
    lane: effectiveLane,
    fetchedConversations: totalFetched,
    createdLeads: totalCreated,
    nextCursor: latestResult.nextCursor,
    watermarkIso: latestResult.watermarkIso,
    latest: {
      ran: latestResult.ran,
      reason: latestResult.reason,
      fetchedConversations: latestResult.fetchedConversations,
      createdLeads: latestResult.createdLeads,
      watermarkIso: latestResult.watermarkIso,
    },
    backfill: {
      ran: false,
      reason: 'backfill_removed',
      fetchedConversations: 0,
      createdLeads: 0,
      nextCursor: null,
    },
  }
}

export async function runFacebookSyncWithControl(
  trigger: FacebookSyncTrigger,
  lane: FacebookSyncLane = 'LATEST',
): Promise<RunFacebookSyncResult> {
  const acquired = await tryAcquireSyncLock()
  if (!acquired) {
    return { ran: false, reason: 'sync_lock_busy', lane }
  }

  try {
    return await runIncrementalSync(trigger, lane)
  } finally {
    await releaseSyncLock()
  }
}

function isLaneDue(lastRunAt: Date | null, intervalMinutes: number, nowMs: number): boolean {
  if (!lastRunAt) return true
  const nextDueAt = lastRunAt.getTime() + intervalMinutes * 60_000
  return nowMs >= nextDueAt
}

export async function maybeRunFacebookFallbackSync(): Promise<RunFacebookSyncResult> {
  const settings = await ensureControlRow()

  if (!settings.enabled) {
    return { ran: false, reason: 'sync_disabled', lane: 'LATEST' }
  }

  if (!settings.fallbackEnabled) {
    return { ran: false, reason: 'fallback_disabled', lane: 'LATEST' }
  }

  if (!isFacebookConfigured()) {
    return { ran: false, reason: 'facebook_not_configured', lane: 'LATEST' }
  }

  const nowMs = Date.now()
  const latestDue = settings.latestEnabled && isLaneDue(settings.lastLatestSyncAt, settings.latestIntervalMinutes, nowMs)

  if (!latestDue) {
    return { ran: false, reason: 'not_due_yet', lane: 'LATEST' }
  }

  const lane: FacebookSyncLane = 'LATEST'

  const acquired = await tryAcquireSyncLock()
  if (!acquired) {
    return { ran: false, reason: 'sync_lock_busy', lane }
  }

  try {
    return await runIncrementalSync('SCHEDULED_FALLBACK', lane)
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
