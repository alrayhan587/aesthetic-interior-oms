'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Clock3, MapPin, UserRound, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

type QueueItem = {
  leadId: string
  leadName: string
  leadPhone: string | null
  leadLocation: string | null
  stage: string
  subStatus: string | null
  jrArchitectAssignee: { id: string; fullName: string; email: string } | null
  srCrmAssignee: { id: string; fullName: string; email: string } | null
  latestCompletedVisit: {
    id: string
    scheduledAt: string
    completedAt: string | null
    location: string
    projectSqft: number | null
    projectStatus: string | null
    assignedVisitLead: { id: string; fullName: string } | null
    summary: string | null
    budgetRange: string | null
    timelineUrgency: string | null
  } | null
  pendingRequests: Array<{
    id: string
    requestedById: string
    requestedByName: string
    requestedByEmail: string
    note: string | null
    createdAt: string
    status: string
  }>
}

type JrArchitectUser = {
  id: string
  fullName: string
  email: string
}

type QueueResponse = {
  success: boolean
  data?: QueueItem[]
  jrArchitectUsers?: JrArchitectUser[]
  permissions?: {
    canView: boolean
    canAssign: boolean
    canRequest: boolean
  }
  error?: string
}
type DepartmentUsersResponse = {
  success: boolean
  users?: Array<{ id: string; fullName: string; email: string }>
  error?: string
}

type VisitCompleteQueueBoardProps = {
  title: string
  subtitle: string
  leadHrefPrefix?: string | null
}

function formatDateTime(value: string | null): string {
  if (!value) return 'N/A'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'N/A'
  return parsed.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function VisitCompleteQueueBoard({
  title,
  subtitle,
  leadHrefPrefix = null,
}: VisitCompleteQueueBoardProps) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<QueueItem[]>([])
  const [jrArchitectUsers, setJrArchitectUsers] = useState<JrArchitectUser[]>([])
  const [canAssign, setCanAssign] = useState(false)
  const [canRequest, setCanRequest] = useState(false)
  const [selectedByLead, setSelectedByLead] = useState<Record<string, string>>({})
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null)

  const loadQueue = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/visit-complete-queue', { cache: 'no-store' })
      const payload = (await response.json()) as QueueResponse
      if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
        throw new Error(payload.error ?? 'Failed to load queue')
      }

      setItems(payload.data)
      const canAssignFlag = Boolean(payload.permissions?.canAssign)
      let nextJrArchitectUsers = payload.jrArchitectUsers ?? []
      if (canAssignFlag && nextJrArchitectUsers.length === 0) {
        const usersResponse = await fetch('/api/department/available/JR_ARCHITECT', {
          cache: 'no-store',
        })
        const usersPayload = (await usersResponse.json()) as DepartmentUsersResponse
        if (usersResponse.ok && usersPayload.success && Array.isArray(usersPayload.users)) {
          nextJrArchitectUsers = usersPayload.users
        }
      }

      setJrArchitectUsers(nextJrArchitectUsers)
      setCanAssign(canAssignFlag)
      setCanRequest(Boolean(payload.permissions?.canRequest))
      setSelectedByLead((prev) => {
        const next: Record<string, string> = { ...prev }
        for (const item of payload.data ?? []) {
          const preferred = item.pendingRequests[0]?.requestedById
            ?? item.jrArchitectAssignee?.id
            ?? nextJrArchitectUsers[0]?.id
            ?? ''
          if (!next[item.leadId] && preferred) {
            next[item.leadId] = preferred
          }
        }
        return next
      })
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Failed to load queue')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadQueue()
  }, [loadQueue])

  const queueStats = useMemo(() => {
    const pendingRequests = items.reduce((count, item) => count + item.pendingRequests.length, 0)
    return {
      total: items.length,
      pendingRequests,
      withSrAssigned: items.filter((item) => Boolean(item.srCrmAssignee)).length,
      withoutSrAssigned: items.filter((item) => !item.srCrmAssignee).length,
    }
  }, [items])

  const requestLead = useCallback(async (leadId: string) => {
    setBusyLeadId(leadId)
    try {
      const response = await fetch('/api/visit-complete-queue/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? 'Failed to submit request')
      }
      toast.success(payload.message ?? 'Request submitted')
      await loadQueue()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit request')
    } finally {
      setBusyLeadId(null)
    }
  }, [loadQueue])

  const assignLead = useCallback(async (leadId: string, requestId?: string) => {
    const selectedUserId = requestId
      ? items.find((item) => item.leadId === leadId)?.pendingRequests.find((req) => req.id === requestId)?.requestedById
      : selectedByLead[leadId]

    if (!selectedUserId) {
      toast.error('Select a JR Architect first')
      return
    }

    setBusyLeadId(leadId)
    try {
      const response = await fetch('/api/visit-complete-queue/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          jrArchitectUserId: selectedUserId,
          requestId: requestId ?? null,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? 'Failed to assign JR Architect')
      }
      toast.success(payload.message ?? 'JR Architect assigned')
      await loadQueue()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign JR Architect')
    } finally {
      setBusyLeadId(null)
    }
  }, [items, loadQueue, selectedByLead])

  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader title={title} subtitle={subtitle} />

      <main className="mx-auto max-w-[1440px] px-6 py-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Visit Completed Leads</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{queueStats.total}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Pending JR Requests</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{queueStats.pendingRequests}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">With SR Assigned</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{queueStats.withSrAssigned}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Without SR Assigned</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{queueStats.withoutSrAssigned}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visit Complete Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading queue...</p>
            ) : null}

            {!loading && items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No leads are waiting in visit completed queue.
              </div>
            ) : null}

            {items.map((item) => (
              <Card
                key={item.leadId}
                className="overflow-hidden border-border/70 shadow-sm transition hover:shadow-md"
              >
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold text-foreground">{item.leadName}</p>
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          <Sparkles className="mr-1 h-3 w-3" />
                          Visit Completed
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.stage}
                        {item.subStatus ? ` -> ${item.subStatus}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {leadHrefPrefix ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={`${leadHrefPrefix}/${item.leadId}`}>Open Lead</Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm md:grid-cols-2">
                    <p className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      Visit Date:
                      <span className="font-medium text-foreground">
                        {formatDateTime(item.latestCompletedVisit?.scheduledAt ?? null)}
                      </span>
                    </p>
                    <p className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      Completed:
                      <span className="font-medium text-foreground">
                        {formatDateTime(item.latestCompletedVisit?.completedAt ?? null)}
                      </span>
                    </p>
                    <p className="inline-flex items-center gap-1 text-muted-foreground md:col-span-2">
                      <MapPin className="h-3.5 w-3.5" />
                      Location:
                      <span className="font-medium text-foreground">
                        {item.latestCompletedVisit?.location ?? 'N/A'}
                      </span>
                    </p>
                    <p className="text-muted-foreground md:col-span-2">
                      Summary:{' '}
                      <span className="font-medium text-foreground">
                        {item.latestCompletedVisit?.summary ?? 'No summary'}
                      </span>
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-border/60 bg-background p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SR CRM</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-sm text-foreground">
                        <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                        {item.srCrmAssignee?.fullName ?? 'Unassigned'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">JR Architect</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-sm text-foreground">
                        <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                        {item.jrArchitectAssignee?.fullName ?? 'Unassigned'}
                      </p>
                    </div>
                  </div>

                  {item.pendingRequests.length > 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                        Pending JR Architect Requests
                      </p>
                      {item.pendingRequests.map((request) => (
                        <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-white p-2">
                          <div>
                            <p className="text-sm font-medium text-foreground">{request.requestedByName}</p>
                            <p className="text-xs text-muted-foreground">
                              Requested at {formatDateTime(request.createdAt)}
                            </p>
                            {request.note ? (
                              <p className="text-xs text-muted-foreground mt-1">{request.note}</p>
                            ) : null}
                          </div>
                          {canAssign ? (
                            <Button
                              size="sm"
                              disabled={busyLeadId === item.leadId}
                              onClick={() => assignLead(item.leadId, request.id)}
                            >
                              Approve & Assign
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    {canAssign ? (
                      <>
                        <Select
                          value={selectedByLead[item.leadId] ?? ''}
                          onValueChange={(value) =>
                            setSelectedByLead((prev) => ({ ...prev, [item.leadId]: value }))
                          }
                        >
                          <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Select JR Architect" />
                          </SelectTrigger>
                          <SelectContent>
                            {jrArchitectUsers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={() => assignLead(item.leadId)}
                          disabled={busyLeadId === item.leadId || !selectedByLead[item.leadId]}
                        >
                          Assign JR Architect
                        </Button>
                      </>
                    ) : null}

                    {canRequest ? (
                      <Button
                        variant="secondary"
                        disabled={busyLeadId === item.leadId || Boolean(item.jrArchitectAssignee)}
                        onClick={() => requestLead(item.leadId)}
                      >
                        {item.jrArchitectAssignee ? 'Already Assigned' : 'Request to Work'}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
