'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Save, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'

type VisitWorkflowControl = {
  supportDataEnabled: boolean
  createdAt: string
  updatedAt: string
}

type VisitWorkflowSettingsResponse = {
  success: boolean
  data?: {
    control: VisitWorkflowControl
  }
  error?: string
  message?: string
}

export function VisitWorkflowSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [supportDataEnabled, setSupportDataEnabled] = useState(true)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setStatusError(null)
    try {
      const response = await fetch('/api/visit-team/workflow-settings', { cache: 'no-store' })
      const payload = (await response.json()) as VisitWorkflowSettingsResponse
      if (!response.ok || !payload.success || !payload.data?.control) {
        throw new Error(payload.error ?? 'Failed to load visit workflow settings')
      }
      setSupportDataEnabled(payload.data.control.supportDataEnabled)
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Failed to load visit workflow settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const save = async () => {
    setSaving(true)
    setStatusMessage(null)
    setStatusError(null)

    try {
      const response = await fetch('/api/visit-team/workflow-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supportDataEnabled }),
      })
      const payload = (await response.json()) as VisitWorkflowSettingsResponse
      if (!response.ok || !payload.success || !payload.data?.control) {
        throw new Error(payload.error ?? 'Failed to save visit workflow settings')
      }
      setSupportDataEnabled(payload.data.control.supportDataEnabled)
      setStatusMessage(payload.message ?? 'Visit workflow settings updated')
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Failed to save visit workflow settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Visit Team Workflow</CardTitle>
          <CardDescription>
            Control whether support members can submit support data and whether lead completion depends on it.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Support Data Workflow
          </CardTitle>
          <CardDescription>
            When off: support members become read-only and visit leads can complete visits without waiting for support submission.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Enable Support Data Workflow</p>
              <p className="text-xs text-muted-foreground">
                Requires first support member submission before lead completion and allows support data actions.
              </p>
            </div>
            <Switch
              checked={supportDataEnabled}
              onCheckedChange={setSupportDataEnabled}
              disabled={loading || saving}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void save()} disabled={loading || saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button variant="outline" onClick={() => void loadSettings()} disabled={loading || saving}>
              Refresh
            </Button>
          </div>

          {statusMessage ? (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {statusMessage}
            </div>
          ) : null}
          {statusError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <p>{statusError}</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
