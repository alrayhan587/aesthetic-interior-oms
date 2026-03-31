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

type FacebookConfig = {
  configured: boolean
  tokenConfigured: boolean
  pageIdConfigured: boolean
  graphVersion: string
  pageId: string | null
}

type SettingsResponse = {
  success: boolean
  data?: {
    syncControl: SyncControl
    facebookConfig: FacebookConfig
  }
  error?: string
}

type SyncResponse = {
  success: boolean
  data?: {
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  const [config, setConfig] = useState<FacebookConfig | null>(null)
  const [syncControl, setSyncControl] = useState<SyncControl | null>(null)

  const [enabled, setEnabled] = useState(true)
  const [fallbackEnabled, setFallbackEnabled] = useState(true)
  const [fallbackIntervalMinutes, setFallbackIntervalMinutes] = useState(15)
  const [batchLimit, setBatchLimit] = useState(20)

  const hydrateForm = useCallback((state: SyncControl) => {
    setEnabled(state.enabled)
    setFallbackEnabled(state.fallbackEnabled)
    setFallbackIntervalMinutes(state.fallbackIntervalMinutes)
    setBatchLimit(state.batchLimit)
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

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const hasUnsavedChanges = useMemo(() => {
    if (!syncControl) return false
    return (
      enabled !== syncControl.enabled ||
      fallbackEnabled !== syncControl.fallbackEnabled ||
      fallbackIntervalMinutes !== syncControl.fallbackIntervalMinutes ||
      batchLimit !== syncControl.batchLimit
    )
  }, [batchLimit, enabled, fallbackEnabled, fallbackIntervalMinutes, syncControl])

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
      setStatusMessage('Facebook sync settings saved.')
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const runSyncNow = async () => {
    setSyncingNow(true)
    setStatusMessage(null)
    setStatusError(null)

    try {
      const response = await fetch('/api/facebook/sync', { method: 'POST' })
      const payload = (await response.json()) as SyncResponse
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Failed to run sync')
      }

      await loadSettings()
      setStatusMessage(
        `Sync completed. Created ${payload.data?.createdLeads ?? 0} leads from ${payload.data?.fetchedConversations ?? 0} conversations.`,
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

  if (loading || !syncControl || !config) {
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
              <p className="text-xs text-muted-foreground">Last Sync</p>
              <p className="mt-1 text-sm font-medium text-foreground">{formatDate(syncControl.lastSyncAt)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Status: {syncControl.lastSyncStatus ?? 'N/A'} | Trigger: {syncControl.lastSyncTrigger ?? 'N/A'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Last fetched: {syncControl.lastSyncFetched ?? 0} | Last created: {syncControl.lastSyncCreated ?? 0}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Watermark: {formatDate(syncControl.incrementalWatermark)}
              </p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">Next Fallback Window</p>
              <p className="mt-1 text-sm font-medium text-foreground">{formatDate(syncControl.nextScheduledAt)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Graph API: {config.graphVersion} | Page ID configured: {config.pageIdConfigured ? 'Yes' : 'No'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Token configured: {config.tokenConfigured ? 'Yes' : 'No'}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                Cursor: {syncControl.incrementalCursor ?? 'none'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                JR CRM round-robin pointer: {syncControl.jrCrmRoundRobinOffset}
              </p>
            </div>
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
              <Button variant="outline" onClick={runSyncNow} disabled={syncingNow || !config.configured} className="gap-2">
                {syncingNow ? <RefreshCw className="size-4 animate-spin" /> : <Settings className="size-4" />}
                Sync Now
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

      <Card className="border-blue-200 bg-blue-50/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="size-4" />
            How This Sync Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-blue-900">
          <p>1. Facebook sends webhook events instantly when conversations happen.</p>
          <p>2. If anything is missed, fallback sync runs on app traffic and imports recent conversations safely.</p>
          <p>3. Duplicate protection is enabled, so the same conversation is not imported twice.</p>
          <p>4. Batch size controls how many recent conversations are checked in one run.</p>
          <p>5. Fallback interval controls how often traffic-triggered checks are allowed to run.</p>
        </CardContent>
      </Card>
    </div>
  )
}
