'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'

import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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

type WhatsAppWebhookEvent = {
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

type MonitorResponse = {
  success: boolean
  data?: {
    checkedAt: string
    control: WhatsAppControl
    recentEvents: WhatsAppWebhookEvent[]
    config: {
      verifyTokenConfigured: boolean
      appSecretConfigured: boolean
      wawpSecretConfigured: boolean
    }
  }
  error?: string
}
type MonitorConfig = NonNullable<MonitorResponse['data']>['config']

async function readMonitorResponse(response: Response): Promise<MonitorResponse> {
  const raw = await response.text()
  if (!raw.trim()) {
    throw new Error(`Monitor API returned empty response (status ${response.status})`)
  }

  try {
    return JSON.parse(raw) as MonitorResponse
  } catch {
    throw new Error(`Monitor API returned invalid JSON (status ${response.status})`)
  }
}

function formatDate(value: string | null): string {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString()
}

export default function WhatsAppMonitorPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [control, setControl] = useState<WhatsAppControl | null>(null)
  const [events, setEvents] = useState<WhatsAppWebhookEvent[]>([])
  const [config, setConfig] = useState<MonitorConfig | null>(null)

  const loadMonitor = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    else setLoading(true)

    setError(null)

    try {
      const response = await fetch('/api/whatsapp/monitor?limit=20', { cache: 'no-store' })
      const payload = await readMonitorResponse(response)
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? `Failed to load WhatsApp monitor (status ${response.status})`)
      }

      setCheckedAt(payload.data.checkedAt)
      setControl(payload.data.control)
      setEvents(payload.data.recentEvents)
      setConfig(payload.data.config)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load WhatsApp monitor')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadMonitor()

    const intervalId = window.setInterval(() => {
      void loadMonitor()
    }, 20_000)

    return () => window.clearInterval(intervalId)
  }, [loadMonitor])

  const statusBadge = useMemo(() => {
    if (!control) return null
    if (!control.enabled) return <Badge className="bg-amber-100 text-amber-800">Disabled</Badge>
    if (control.lastWebhookStatus === 'FAILED') return <Badge className="bg-red-100 text-red-800">Last Failed</Badge>
    return <Badge className="bg-green-100 text-green-800">Active</Badge>
  }, [control])

  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader title="WhatsApp Monitor" subtitle="Last event status and recent webhook outcomes" />
      <main className="mx-auto max-w-[1440px] px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void loadMonitor(true)} disabled={refreshing} className="gap-2">
              {refreshing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
            {statusBadge}
            <p className="text-xs text-muted-foreground">Checked at: {formatDate(checkedAt)}</p>
          </div>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null}

          {loading || !control || !config ? (
            <Card className="border-border">
              <CardContent className="py-8 text-sm text-muted-foreground">Loading monitor data...</CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Current Health</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground">Last Webhook</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{formatDate(control.lastWebhookAt)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Status: {control.lastWebhookStatus ?? 'N/A'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Created: {control.lastCreatedLeads} | Processed: {control.lastProcessedMessages}</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground">Skip Reasons (Last Event)</p>
                    <p className="mt-1 text-xs text-muted-foreground">Existing phone: {control.lastSkippedExistingPhone}</p>
                    <p className="mt-1 text-xs text-muted-foreground">No phone: {control.lastSkippedNoPhone}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Duplicate message: {control.lastSkippedDuplicateMessage}</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground">Config</p>
                    <p className="mt-1 text-xs text-muted-foreground">Verify token: {config.verifyTokenConfigured ? 'Yes' : 'No'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">App secret: {config.appSecretConfigured ? 'Yes' : 'No'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">WAWP secret: {config.wawpSecretConfigured ? 'Yes' : 'No'}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Last 20 Webhook Outcomes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No webhook outcomes logged yet.</p>
                  ) : (
                    events.map((event) => (
                      <div key={event.id} className="rounded-lg border border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {event.status === 'SUCCESS' ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <p className="text-sm font-medium text-foreground">{event.status}</p>
                            <Badge variant="outline">{event.source ?? 'UNKNOWN'}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</p>
                        </div>
                        <div className="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-3">
                          <p>Processed: {event.processedMessages}</p>
                          <p>Created: {event.createdLeads}</p>
                          <p>Skip existing phone: {event.skippedExistingPhone}</p>
                          <p>Skip no phone: {event.skippedNoPhone}</p>
                          <p>Skip duplicate msg: {event.skippedDuplicateMessage}</p>
                        </div>
                        {event.error ? (
                          <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                            <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
                            <p>{event.error}</p>
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
