'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, CheckCircle2, RefreshCw, Save, Settings } from 'lucide-react'

type SyncControl = {
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

type FacebookConfig = {
  configured: boolean
  tokenConfigured: boolean
  pageIdConfigured: boolean
  graphVersion: string
  pageId: string | null
}

type InstagramConfig = {
  configured: boolean
  tokenConfigured: boolean
  entityIdConfigured: boolean
  graphVersion: string
  entityId: string | null
}

type SettingsResponse = {
  success: boolean
  data?: {
    syncControl: SyncControl
    facebookConfig: FacebookConfig
  }
  error?: string
}

type InstagramSettingsResponse = {
  success: boolean
  data?: {
    syncControl: SyncControl
    instagramConfig: InstagramConfig
  }
  error?: string
}

type WhatsAppControl = {
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
}

type WhatsAppSettingsResponse = {
  success: boolean
  data?: {
    control: WhatsAppControl
    config: {
      verifyTokenConfigured: boolean
      appSecretConfigured: boolean
      wawpSecretConfigured: boolean
    }
  }
  error?: string
  message?: string
}

type WhatsAppStatusResponse = {
  success: boolean
  data?: {
    checkedAt: string
    config: {
      verifyTokenConfigured: boolean
      appSecretConfigured: boolean
      wawpSecretConfigured: boolean
    }
    control: WhatsAppControl
  }
  error?: string
}

type SyncResponse = {
  success: boolean
  data?: {
    lane?: 'LATEST' | 'BACKFILL' | 'BOTH'
    fetchedConversations?: number
    createdLeads?: number
    ran?: boolean
    reason?: string
  }
  message?: string
  error?: string
}

const INTERVAL_OPTIONS = [5, 10, 15, 30, 60, 120, 240, 720, 1440]

function formatDate(value: string | null): string {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString()
}

export function IntegrationSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncingNow, setSyncingNow] = useState(false)
  const [checking, setChecking] = useState(false)
  const [instagramSaving, setInstagramSaving] = useState(false)
  const [instagramSyncingNow, setInstagramSyncingNow] = useState(false)
  const [instagramChecking, setInstagramChecking] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [instagramStatusMessage, setInstagramStatusMessage] = useState<string | null>(null)
  const [instagramStatusError, setInstagramStatusError] = useState<string | null>(null)
  const [whatsAppStatusMessage, setWhatsAppStatusMessage] = useState<string | null>(null)
  const [whatsAppStatusError, setWhatsAppStatusError] = useState<string | null>(null)

  const [config, setConfig] = useState<FacebookConfig | null>(null)
  const [syncControl, setSyncControl] = useState<SyncControl | null>(null)
  const [instagramConfig, setInstagramConfig] = useState<InstagramConfig | null>(null)
  const [instagramSyncControl, setInstagramSyncControl] = useState<SyncControl | null>(null)
  const [whatsAppControl, setWhatsAppControl] = useState<WhatsAppControl | null>(null)
  const [whatsAppConfig, setWhatsAppConfig] = useState<
    NonNullable<WhatsAppSettingsResponse['data']>['config'] | null
  >(null)

  const [enabled, setEnabled] = useState(true)
  const [latestEnabled, setLatestEnabled] = useState(true)
  const [latestIntervalMinutes, setLatestIntervalMinutes] = useState(2)
  const [latestBatchLimit, setLatestBatchLimit] = useState(20)
  const [backfillEnabled, setBackfillEnabled] = useState(true)
  const [backfillIntervalMinutes, setBackfillIntervalMinutes] = useState(15)
  const [backfillBatchLimit, setBackfillBatchLimit] = useState(20)
  const [fallbackEnabled, setFallbackEnabled] = useState(true)
  const [fallbackIntervalMinutes, setFallbackIntervalMinutes] = useState(15)
  const [batchLimit, setBatchLimit] = useState(20)
  const [instagramEnabled, setInstagramEnabled] = useState(true)
  const [instagramFallbackEnabled, setInstagramFallbackEnabled] = useState(true)
  const [instagramFallbackIntervalMinutes, setInstagramFallbackIntervalMinutes] = useState(15)
  const [instagramBatchLimit, setInstagramBatchLimit] = useState(20)
  const [whatsAppEnabled, setWhatsAppEnabled] = useState(true)
  const [whatsAppSaving, setWhatsAppSaving] = useState(false)
  const [checkingWhatsApp, setCheckingWhatsApp] = useState(false)

  const hydrateForm = useCallback((state: SyncControl) => {
    setEnabled(state.enabled)
    setLatestEnabled(state.latestEnabled)
    setLatestIntervalMinutes(state.latestIntervalMinutes)
    setLatestBatchLimit(state.latestBatchLimit)
    setBackfillEnabled(state.backfillEnabled)
    setBackfillIntervalMinutes(state.backfillIntervalMinutes)
    setBackfillBatchLimit(state.backfillBatchLimit)
    setFallbackEnabled(state.fallbackEnabled)
    setFallbackIntervalMinutes(state.fallbackIntervalMinutes)
    setBatchLimit(state.batchLimit)
  }, [])

  const hydrateInstagramForm = useCallback((state: SyncControl) => {
    setInstagramEnabled(state.enabled)
    setInstagramFallbackEnabled(state.fallbackEnabled)
    setInstagramFallbackIntervalMinutes(state.fallbackIntervalMinutes)
    setInstagramBatchLimit(state.batchLimit)
  }, [])

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setStatusError(null)

    try {
      const response = await fetch('/api/facebook/sync-settings', { cache: 'no-store' })
      const payload = (await response.json()) as SettingsResponse

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Failed to load Facebook sync settings')
      }

      setConfig(payload.data.facebookConfig)
      setSyncControl(payload.data.syncControl)
      hydrateForm(payload.data.syncControl)
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [hydrateForm])

  const loadWhatsAppSettings = useCallback(async () => {
    setWhatsAppStatusError(null)
    try {
      const response = await fetch('/api/whatsapp/sync-settings', { cache: 'no-store' })
      const payload = (await response.json()) as WhatsAppSettingsResponse
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Failed to load WhatsApp settings')
      }

      setWhatsAppControl(payload.data.control)
      setWhatsAppConfig(payload.data.config)
      setWhatsAppEnabled(payload.data.control.enabled)
    } catch (error) {
      setWhatsAppStatusError(error instanceof Error ? error.message : 'Failed to load WhatsApp settings')
    }
  }, [])

  const loadInstagramSettings = useCallback(async () => {
    setInstagramStatusError(null)
    try {
      const response = await fetch('/api/instagram/sync-settings', { cache: 'no-store' })
      const payload = (await response.json()) as InstagramSettingsResponse

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Failed to load Instagram sync settings')
      }

      setInstagramConfig(payload.data.instagramConfig)
      setInstagramSyncControl(payload.data.syncControl)
      hydrateInstagramForm(payload.data.syncControl)
    } catch (error) {
      setInstagramStatusError(error instanceof Error ? error.message : 'Failed to load Instagram settings')
    }
  }, [hydrateInstagramForm])

  useEffect(() => {
    void loadSettings()
    void loadInstagramSettings()
    void loadWhatsAppSettings()
  }, [loadInstagramSettings, loadSettings, loadWhatsAppSettings])

  const hasUnsavedChanges = useMemo(() => {
    if (!syncControl) return false
    return (
      enabled !== syncControl.enabled ||
      latestEnabled !== syncControl.latestEnabled ||
      latestIntervalMinutes !== syncControl.latestIntervalMinutes ||
      latestBatchLimit !== syncControl.latestBatchLimit ||
      backfillEnabled !== syncControl.backfillEnabled ||
      backfillIntervalMinutes !== syncControl.backfillIntervalMinutes ||
      backfillBatchLimit !== syncControl.backfillBatchLimit ||
      fallbackEnabled !== syncControl.fallbackEnabled ||
      fallbackIntervalMinutes !== syncControl.fallbackIntervalMinutes ||
      batchLimit !== syncControl.batchLimit
    )
  }, [
    backfillBatchLimit,
    backfillEnabled,
    backfillIntervalMinutes,
    batchLimit,
    enabled,
    fallbackEnabled,
    fallbackIntervalMinutes,
    latestBatchLimit,
    latestEnabled,
    latestIntervalMinutes,
    syncControl,
  ])

  const hasUnsavedWhatsAppChanges = useMemo(() => {
    if (!whatsAppControl) return false
    return whatsAppEnabled !== whatsAppControl.enabled
  }, [whatsAppControl, whatsAppEnabled])

  const hasUnsavedInstagramChanges = useMemo(() => {
    if (!instagramSyncControl) return false
    return (
      instagramEnabled !== instagramSyncControl.enabled ||
      instagramFallbackEnabled !== instagramSyncControl.fallbackEnabled ||
      instagramFallbackIntervalMinutes !== instagramSyncControl.fallbackIntervalMinutes ||
      instagramBatchLimit !== instagramSyncControl.batchLimit
    )
  }, [
    instagramBatchLimit,
    instagramEnabled,
    instagramFallbackEnabled,
    instagramFallbackIntervalMinutes,
    instagramSyncControl,
  ])

  const saveSettings = async () => {
    setSaving(true)
    setStatusMessage(null)
    setStatusError(null)

    try {
      const response = await fetch('/api/facebook/sync-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          latestEnabled,
          latestIntervalMinutes,
          latestBatchLimit,
          backfillEnabled,
          backfillIntervalMinutes,
          backfillBatchLimit,
          fallbackEnabled,
          fallbackIntervalMinutes,
          batchLimit,
        }),
      })

      const payload = (await response.json()) as SettingsResponse
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Failed to save settings')
      }

      setConfig(payload.data.facebookConfig)
      setSyncControl(payload.data.syncControl)
      hydrateForm(payload.data.syncControl)
      setStatusMessage('Facebook sync lane settings saved.')
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const runSyncNow = async (lane: 'LATEST' | 'BACKFILL' | 'BOTH' = 'BOTH') => {
    setSyncingNow(true)
    setStatusMessage(null)
    setStatusError(null)

    try {
      const response = await fetch('/api/facebook/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lane }),
      })
      const payload = (await response.json()) as SyncResponse
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Failed to run sync')
      }

      await loadSettings()
      setStatusMessage(
        `${lane} sync completed. Created ${payload.data?.createdLeads ?? 0} leads from ${payload.data?.fetchedConversations ?? 0} conversations.`,
      )
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Failed to run sync')
    } finally {
      setSyncingNow(false)
    }
  }

  const checkConnection = async () => {
    setChecking(true)
    setStatusMessage(null)
    setStatusError(null)

    try {
      const response = await fetch('/api/facebook/status', { cache: 'no-store' })
      const payload = (await response.json()) as {
        success?: boolean
        data?: { graphConnection?: { ok?: boolean; error?: string } }
      }

      if (!response.ok || !payload.success) {
        throw new Error('Failed to check connection')
      }

      const ok = Boolean(payload.data?.graphConnection?.ok)
      if (ok) {
        setStatusMessage('Facebook Graph connection looks healthy.')
      } else {
        setStatusError(payload.data?.graphConnection?.error ?? 'Facebook Graph check failed')
      }

      await loadSettings()
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Failed to check connection')
    } finally {
      setChecking(false)
    }
  }

  const saveInstagramSettings = async () => {
    setInstagramSaving(true)
    setInstagramStatusMessage(null)
    setInstagramStatusError(null)

    try {
      const response = await fetch('/api/instagram/sync-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: instagramEnabled,
          fallbackEnabled: instagramFallbackEnabled,
          fallbackIntervalMinutes: instagramFallbackIntervalMinutes,
          batchLimit: instagramBatchLimit,
        }),
      })

      const payload = (await response.json()) as InstagramSettingsResponse
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Failed to save Instagram settings')
      }

      setInstagramConfig(payload.data.instagramConfig)
      setInstagramSyncControl(payload.data.syncControl)
      hydrateInstagramForm(payload.data.syncControl)
      setInstagramStatusMessage('Instagram sync settings saved.')
    } catch (error) {
      setInstagramStatusError(error instanceof Error ? error.message : 'Failed to save Instagram settings')
    } finally {
      setInstagramSaving(false)
    }
  }

  const runInstagramSyncNow = async () => {
    setInstagramSyncingNow(true)
    setInstagramStatusMessage(null)
    setInstagramStatusError(null)

    try {
      const response = await fetch('/api/instagram/sync', { method: 'POST' })
      const payload = (await response.json()) as SyncResponse
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Failed to run Instagram sync')
      }

      await loadInstagramSettings()
      setInstagramStatusMessage(
        `Instagram sync completed. Created ${payload.data?.createdLeads ?? 0} leads from ${payload.data?.fetchedConversations ?? 0} conversations.`,
      )
    } catch (error) {
      setInstagramStatusError(error instanceof Error ? error.message : 'Failed to run Instagram sync')
    } finally {
      setInstagramSyncingNow(false)
    }
  }

  const checkInstagramConnection = async () => {
    setInstagramChecking(true)
    setInstagramStatusMessage(null)
    setInstagramStatusError(null)

    try {
      const response = await fetch('/api/instagram/status', { cache: 'no-store' })
      const payload = (await response.json()) as {
        success?: boolean
        data?: { graphConnection?: { ok?: boolean; error?: string } }
      }

      if (!response.ok || !payload.success) {
        throw new Error('Failed to check Instagram connection')
      }

      const ok = Boolean(payload.data?.graphConnection?.ok)
      if (ok) {
        setInstagramStatusMessage('Instagram Graph connection looks healthy.')
      } else {
        setInstagramStatusError(payload.data?.graphConnection?.error ?? 'Instagram Graph check failed')
      }

      await loadInstagramSettings()
    } catch (error) {
      setInstagramStatusError(error instanceof Error ? error.message : 'Failed to check Instagram connection')
    } finally {
      setInstagramChecking(false)
    }
  }

  const saveWhatsAppSettings = async () => {
    setWhatsAppSaving(true)
    setWhatsAppStatusError(null)
    setWhatsAppStatusMessage(null)
    try {
      const response = await fetch('/api/whatsapp/sync-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: whatsAppEnabled }),
      })
      const payload = (await response.json()) as WhatsAppSettingsResponse
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Failed to save WhatsApp settings')
      }

      setWhatsAppControl(payload.data.control)
      setWhatsAppConfig(payload.data.config)
      setWhatsAppEnabled(payload.data.control.enabled)
      setWhatsAppStatusMessage(payload.message ?? 'WhatsApp settings saved.')
    } catch (error) {
      setWhatsAppStatusError(error instanceof Error ? error.message : 'Failed to save WhatsApp settings')
    } finally {
      setWhatsAppSaving(false)
    }
  }

  const checkWhatsAppStatus = async () => {
    setCheckingWhatsApp(true)
    setWhatsAppStatusError(null)
    setWhatsAppStatusMessage(null)

    try {
      const response = await fetch('/api/whatsapp/status', { cache: 'no-store' })
      const payload = (await response.json()) as WhatsAppStatusResponse
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Failed to check WhatsApp status')
      }

      const control = payload.data.control
      const config = payload.data.config
      const isConfigured = config.verifyTokenConfigured || config.wawpSecretConfigured
      const isRunning = control.enabled && isConfigured

      setWhatsAppControl(control)
      setWhatsAppConfig(config)
      setWhatsAppEnabled(control.enabled)

      if (isRunning) {
        setWhatsAppStatusMessage(
          `WhatsApp is running. Last webhook: ${formatDate(control.lastWebhookAt)} (${control.lastWebhookStatus ?? 'N/A'}).`,
        )
      } else if (!control.enabled) {
        setWhatsAppStatusError('WhatsApp is not running: ingestion is disabled.')
      } else {
        setWhatsAppStatusError('WhatsApp is not running: webhook security/config is incomplete.')
      }
    } catch (error) {
      setWhatsAppStatusError(error instanceof Error ? error.message : 'Failed to check WhatsApp status')
    } finally {
      setCheckingWhatsApp(false)
    }
  }

  if (loading || !syncControl || !config || !whatsAppControl || !whatsAppConfig) {
    return (
      <Card className="border-border">
        <CardContent className="py-8 text-sm text-muted-foreground">Loading integration settings...</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Facebook Lead Sync Control</CardTitle>
              <CardDescription>
                Manage real-time sync behavior and a safe traffic-triggered fallback from this panel.
              </CardDescription>
            </div>
            <Badge className={config.configured ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}>
              {config.configured ? 'Connected' : 'Not Configured'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">Latest Lane</p>
              <p className="mt-1 text-sm font-medium text-foreground">{formatDate(syncControl.lastLatestSyncAt)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Status: {syncControl.lastLatestSyncStatus ?? 'N/A'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Last fetched: {syncControl.lastLatestSyncFetched ?? 0} | Last created: {syncControl.lastLatestSyncCreated ?? 0}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Next latest window: {formatDate(syncControl.nextLatestScheduledAt)}
              </p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">Backfill Lane</p>
              <p className="mt-1 text-sm font-medium text-foreground">{formatDate(syncControl.lastBackfillSyncAt)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Status: {syncControl.lastBackfillSyncStatus ?? 'N/A'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Last fetched: {syncControl.lastBackfillSyncFetched ?? 0} | Last created: {syncControl.lastBackfillSyncCreated ?? 0}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                Next backfill window: {formatDate(syncControl.nextBackfillScheduledAt)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cursor: {syncControl.backfillCursor ?? syncControl.incrementalCursor ?? 'none'}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground">Global Status</p>
            <p className="mt-1 text-sm font-medium text-foreground">{formatDate(syncControl.lastSyncAt)}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Status: {syncControl.lastSyncStatus ?? 'N/A'} | Trigger: {syncControl.lastSyncTrigger ?? 'N/A'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Last fetched: {syncControl.lastSyncFetched ?? 0} | Last created: {syncControl.lastSyncCreated ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Latest watermark: {formatDate(syncControl.latestWatermark ?? syncControl.incrementalWatermark)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Fallback window: {formatDate(syncControl.nextScheduledAt)} | Graph API: {config.graphVersion} | Page ID configured:{' '}
              {config.pageIdConfigured ? 'Yes' : 'No'} | Token configured: {config.tokenConfigured ? 'Yes' : 'No'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JR CRM round-robin pointer: {syncControl.jrCrmRoundRobinOffset}
            </p>
          </div>

          {syncControl.lastSyncError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              Last error: {syncControl.lastSyncError}
            </div>
          )}

          <div className="space-y-4 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Enable Facebook lead sync</p>
                <p className="text-xs text-muted-foreground">Master switch. If disabled, manual and fallback sync are both paused.</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Enable Latest lane</p>
                <p className="text-xs text-muted-foreground">
                  Prioritizes newest conversations with watermark-based sync.
                </p>
              </div>
              <Switch checked={latestEnabled} onCheckedChange={setLatestEnabled} disabled={!enabled} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Latest lane interval</p>
                <Select
                  value={String(latestIntervalMinutes)}
                  onValueChange={(value) => setLatestIntervalMinutes(Number(value))}
                  disabled={!enabled || !latestEnabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select interval" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)}>
                        {minutes} minutes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Latest batch size (5-100)</p>
                <Input
                  type="number"
                  min={5}
                  max={100}
                  value={latestBatchLimit}
                  onChange={(event) => setLatestBatchLimit(Number(event.target.value))}
                  disabled={!enabled || !latestEnabled}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Enable Backfill lane</p>
                <p className="text-xs text-muted-foreground">
                  Continues old/batch history import using pagination cursor.
                </p>
              </div>
              <Switch checked={backfillEnabled} onCheckedChange={setBackfillEnabled} disabled={!enabled} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Backfill lane interval</p>
                <Select
                  value={String(backfillIntervalMinutes)}
                  onValueChange={(value) => setBackfillIntervalMinutes(Number(value))}
                  disabled={!enabled || !backfillEnabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select interval" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)}>
                        {minutes} minutes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Backfill batch size (5-100)</p>
                <Input
                  type="number"
                  min={5}
                  max={100}
                  value={backfillBatchLimit}
                  onChange={(event) => setBackfillBatchLimit(Number(event.target.value))}
                  disabled={!enabled || !backfillEnabled}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Enable safe fallback sync</p>
                <p className="text-xs text-muted-foreground">
                  Runs when app traffic hits lead APIs and imports missed conversations if webhook flow misses anything.
                </p>
              </div>
              <Switch checked={fallbackEnabled} onCheckedChange={setFallbackEnabled} disabled={!enabled} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Fallback interval</p>
                <Select
                  value={String(fallbackIntervalMinutes)}
                  onValueChange={(value) => setFallbackIntervalMinutes(Number(value))}
                  disabled={!enabled || !fallbackEnabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select interval" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)}>
                        {minutes} minutes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Batch size per sync (5-100)</p>
                <Input
                  type="number"
                  min={5}
                  max={100}
                  value={batchLimit}
                  onChange={(event) => setBatchLimit(Number(event.target.value))}
                  disabled={!enabled}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={saveSettings} disabled={saving || !hasUnsavedChanges} className="gap-2">
                {saving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save Settings
              </Button>
              <Button
                variant="outline"
                onClick={() => runSyncNow('LATEST')}
                disabled={syncingNow || !config.configured || !enabled || !latestEnabled}
                className="gap-2"
              >
                {syncingNow ? <RefreshCw className="size-4 animate-spin" /> : <Settings className="size-4" />}
                Run Latest Now
              </Button>
              <Button
                variant="outline"
                onClick={() => runSyncNow('BACKFILL')}
                disabled={syncingNow || !config.configured || !enabled || !backfillEnabled}
                className="gap-2"
              >
                {syncingNow ? <RefreshCw className="size-4 animate-spin" /> : <Settings className="size-4" />}
                Run Backfill Now
              </Button>
              <Button
                variant="outline"
                onClick={() => runSyncNow('BOTH')}
                disabled={syncingNow || !config.configured || !enabled}
                className="gap-2"
              >
                {syncingNow ? <RefreshCw className="size-4 animate-spin" /> : <Settings className="size-4" />}
                Run Both Now
              </Button>
              <Button variant="outline" onClick={checkConnection} disabled={checking} className="gap-2">
                {checking ? <RefreshCw className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Check Connection
              </Button>
            </div>

            {statusMessage && (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-700">
                {statusMessage}
              </div>
            )}
            {statusError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {statusError}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Instagram Lead Sync Control</CardTitle>
              <CardDescription>
                Manage Instagram Graph conversation sync and fallback behavior from this panel.
              </CardDescription>
            </div>
            <Badge className={instagramConfig?.configured ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}>
              {instagramConfig?.configured ? 'Connected' : 'Not Configured'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {!instagramConfig || !instagramSyncControl ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Instagram settings are currently unavailable. Use the check/refresh actions after configuring Instagram env vars.
            </div>
          ) : (
            <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">Last Sync</p>
              <p className="mt-1 text-sm font-medium text-foreground">{formatDate(instagramSyncControl.lastSyncAt)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Status: {instagramSyncControl.lastSyncStatus ?? 'N/A'} | Trigger: {instagramSyncControl.lastSyncTrigger ?? 'N/A'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Last fetched: {instagramSyncControl.lastSyncFetched ?? 0} | Last created: {instagramSyncControl.lastSyncCreated ?? 0}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Watermark: {formatDate(instagramSyncControl.incrementalWatermark)}
              </p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">Next Fallback Window</p>
              <p className="mt-1 text-sm font-medium text-foreground">{formatDate(instagramSyncControl.nextScheduledAt)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Graph API: {instagramConfig.graphVersion} | Entity ID configured: {instagramConfig.entityIdConfigured ? 'Yes' : 'No'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Token configured: {instagramConfig.tokenConfigured ? 'Yes' : 'No'}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                Cursor: {instagramSyncControl.incrementalCursor ?? 'none'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                JR CRM round-robin pointer: {instagramSyncControl.jrCrmRoundRobinOffset}
              </p>
            </div>
          </div>

          {instagramSyncControl.lastSyncError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              Last error: {instagramSyncControl.lastSyncError}
            </div>
          )}

          <div className="space-y-4 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Enable Instagram lead sync</p>
                <p className="text-xs text-muted-foreground">Master switch. If disabled, manual and fallback sync are paused.</p>
              </div>
              <Switch checked={instagramEnabled} onCheckedChange={setInstagramEnabled} />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Enable fallback sync</p>
                <p className="text-xs text-muted-foreground">
                  Runs on app traffic and imports missed Instagram conversations safely.
                </p>
              </div>
              <Switch checked={instagramFallbackEnabled} onCheckedChange={setInstagramFallbackEnabled} disabled={!instagramEnabled} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Fallback interval</p>
                <Select
                  value={String(instagramFallbackIntervalMinutes)}
                  onValueChange={(value) => setInstagramFallbackIntervalMinutes(Number(value))}
                  disabled={!instagramEnabled || !instagramFallbackEnabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select interval" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)}>
                        {minutes} minutes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Batch size per sync (5-100)</p>
                <Input
                  type="number"
                  min={5}
                  max={100}
                  value={instagramBatchLimit}
                  onChange={(event) => setInstagramBatchLimit(Number(event.target.value))}
                  disabled={!instagramEnabled}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={saveInstagramSettings} disabled={instagramSaving || !hasUnsavedInstagramChanges} className="gap-2">
                {instagramSaving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save Instagram Settings
              </Button>
              <Button variant="outline" onClick={runInstagramSyncNow} disabled={instagramSyncingNow || !instagramConfig.configured} className="gap-2">
                {instagramSyncingNow ? <RefreshCw className="size-4 animate-spin" /> : <Settings className="size-4" />}
                Sync Now
              </Button>
              <Button variant="outline" onClick={checkInstagramConnection} disabled={instagramChecking} className="gap-2">
                {instagramChecking ? <RefreshCw className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Check Connection
              </Button>
            </div>

            {instagramStatusMessage && (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-700">
                {instagramStatusMessage}
              </div>
            )}
            {instagramStatusError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {instagramStatusError}
              </div>
            )}
          </div>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadInstagramSettings()} className="gap-2">
              <RefreshCw className="size-4" />
              Refresh Instagram Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>WhatsApp Webhook Control</CardTitle>
              <CardDescription>Monitor webhook ingestion health and toggle processing without redeploying.</CardDescription>
            </div>
            <Badge className={whatsAppControl.enabled ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
              {whatsAppControl.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">Last Webhook</p>
              <p className="mt-1 text-sm font-medium text-foreground">{formatDate(whatsAppControl.lastWebhookAt)}</p>
              <p className="mt-2 text-xs text-muted-foreground">Status: {whatsAppControl.lastWebhookStatus ?? 'N/A'}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Last processed: {whatsAppControl.lastProcessedMessages} | Last created: {whatsAppControl.lastCreatedLeads}
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">Cumulative Counters</p>
              <p className="mt-1 text-xs text-muted-foreground">Webhook events: {whatsAppControl.totalWebhookEvents}</p>
              <p className="mt-1 text-xs text-muted-foreground">Messages processed: {whatsAppControl.totalProcessedMessages}</p>
              <p className="mt-1 text-xs text-muted-foreground">Leads created: {whatsAppControl.totalCreatedLeads}</p>
              <p className="mt-1 text-xs text-muted-foreground">Skipped duplicate message: {whatsAppControl.totalSkippedDuplicateMessage}</p>
              <p className="mt-1 text-xs text-muted-foreground">Skipped existing phone: {whatsAppControl.totalSkippedExistingPhone}</p>
              <p className="mt-1 text-xs text-muted-foreground">Skipped no phone: {whatsAppControl.totalSkippedNoPhone}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 text-xs text-muted-foreground">
            <p>Verify token configured: {whatsAppConfig.verifyTokenConfigured ? 'Yes' : 'No'}</p>
            <p className="mt-1">App secret configured: {whatsAppConfig.appSecretConfigured ? 'Yes' : 'No'}</p>
            <p className="mt-1">WAWP secret configured: {whatsAppConfig.wawpSecretConfigured ? 'Yes' : 'No'}</p>
            <p className="mt-1">JR CRM round-robin pointer: {whatsAppControl.jrCrmRoundRobinOffset}</p>
          </div>

          {whatsAppControl.lastWebhookError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              Last error: {whatsAppControl.lastWebhookError}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Enable WhatsApp ingestion</p>
              <p className="text-xs text-muted-foreground">Master switch for webhook processing.</p>
            </div>
            <Switch checked={whatsAppEnabled} onCheckedChange={setWhatsAppEnabled} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveWhatsAppSettings} disabled={whatsAppSaving || !hasUnsavedWhatsAppChanges} className="gap-2">
              {whatsAppSaving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save WhatsApp Settings
            </Button>
            <Button variant="outline" onClick={() => void loadWhatsAppSettings()} disabled={checkingWhatsApp} className="gap-2">
              {checkingWhatsApp ? <RefreshCw className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Refresh WhatsApp Health
            </Button>
            <Button variant="outline" onClick={() => void checkWhatsAppStatus()} disabled={checkingWhatsApp} className="gap-2">
              {checkingWhatsApp ? <RefreshCw className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Check WhatsApp Status
            </Button>
          </div>

          {whatsAppStatusMessage && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-700">
              {whatsAppStatusMessage}
            </div>
          )}
          {whatsAppStatusError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {whatsAppStatusError}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="size-4" />
            How This Sync Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-blue-900">
          <p>1. Facebook sends webhook events instantly when conversations happen.</p>
          <p>2. Instagram conversation sync follows the same incremental + fallback strategy.</p>
          <p>3. If anything is missed, fallback sync runs on app traffic and imports recent conversations safely.</p>
          <p>4. Duplicate protection is enabled, so the same conversation is not imported twice.</p>
          <p>5. Batch size controls how many recent conversations are checked in one run.</p>
          <p>6. Fallback interval controls how often traffic-triggered checks are allowed to run.</p>
        </CardContent>
      </Card>
    </div>
  )
}
