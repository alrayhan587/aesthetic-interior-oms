'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Phone,
  Mail,
  User,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { fetchMeCached } from '@/lib/client-me'

type FollowUpStatus = 'PENDING' | 'DONE' | 'LATELY_DONE' | 'MISSED'
type TabKey = 'pending' | 'today' | 'overdue' | 'completed' | 'missed'

type FollowUp = {
  id: string
  leadId: string
  assignedToId: string
  followupDate: string
  status: FollowUpStatus
  notes: string | null
  createdAt: string
  lead: {
    id: string
    name: string
    email: string
    phone: string
    stage: string
    subStatus: string | null
  }
  assignedTo: {
    id: string
    fullName: string
    email: string
  }
}

type FollowupsApiResponse = {
  success: boolean
  data?: FollowUp[]
  error?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

type TabState = {
  items: FollowUp[]
  page: number
  totalPages: number
  total: number
  loading: boolean
  loaded: boolean
  error: string | null
}

const PAGE_SIZE = 20

const statusConfig: Record<FollowUpStatus, { icon: ReactNode; color: string; bgColor: string; label: string }> = {
  PENDING: {
    icon: <Clock className="w-4 h-4" />,
    color: 'text-yellow-700 dark:text-yellow-200',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/40',
    label: 'Pending',
  },
  DONE: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: 'text-green-700 dark:text-green-200',
    bgColor: 'bg-green-100 dark:bg-green-900/40',
    label: 'Done',
  },
  LATELY_DONE: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: 'text-blue-700 dark:text-blue-200',
    bgColor: 'bg-blue-100 dark:bg-blue-900/40',
    label: 'Lately Done',
  },
  MISSED: {
    icon: <AlertCircle className="w-4 h-4" />,
    color: 'text-red-700 dark:text-red-200',
    bgColor: 'bg-red-100 dark:bg-red-900/40',
    label: 'Missed',
  },
}

const tabLabels: Record<TabKey, string> = {
  pending: 'Pending',
  today: 'Today',
  overdue: 'Overdue',
  completed: 'Completed',
  missed: 'Missed',
}

const createInitialTabState = (): Record<TabKey, TabState> => ({
  pending: { items: [], page: 1, totalPages: 1, total: 0, loading: false, loaded: false, error: null },
  today: { items: [], page: 1, totalPages: 1, total: 0, loading: false, loaded: false, error: null },
  overdue: { items: [], page: 1, totalPages: 1, total: 0, loading: false, loaded: false, error: null },
  completed: { items: [], page: 1, totalPages: 1, total: 0, loading: false, loaded: false, error: null },
  missed: { items: [], page: 1, totalPages: 1, total: 0, loading: false, loaded: false, error: null },
})

function getDateRangeForFollowups() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  end.setMilliseconds(end.getMilliseconds() - 1)

  const beforeToday = new Date(start)
  beforeToday.setMilliseconds(beforeToday.getMilliseconds() - 1)

  return {
    todayStartIso: start.toISOString(),
    todayEndIso: end.toISOString(),
    beforeTodayIso: beforeToday.toISOString(),
  }
}

export default function FollowupsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('pending')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [tabState, setTabState] = useState<Record<TabKey, TabState>>(createInitialTabState)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [selectedFollowup, setSelectedFollowup] = useState<FollowUp | null>(null)
  const [completionNote, setCompletionNote] = useState('')
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)

  const dateRange = useMemo(getDateRangeForFollowups, [])

  const buildQuery = useCallback(
    (tab: TabKey, page: number) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      })

      if (tab === 'pending') {
        params.set('status', 'PENDING')
      } else if (tab === 'today') {
        params.set('status', 'PENDING')
        params.set('from', dateRange.todayStartIso)
        params.set('to', dateRange.todayEndIso)
      } else if (tab === 'overdue') {
        params.set('status', 'PENDING')
        params.set('to', dateRange.beforeTodayIso)
      } else if (tab === 'completed') {
        params.set('statuses', 'DONE,LATELY_DONE')
      } else if (tab === 'missed') {
        params.set('status', 'MISSED')
      }

      return params
    },
    [dateRange.beforeTodayIso, dateRange.todayEndIso, dateRange.todayStartIso],
  )

  const loadTab = useCallback(
    async (tab: TabKey, page: number, force = false) => {
      const current = tabState[tab]
      if (current.loading) return
      if (!force && current.loaded && current.page === page) return

      setTabState((prev) => ({
        ...prev,
        [tab]: { ...prev[tab], loading: true, error: null },
      }))

      try {
        const params = buildQuery(tab, page)
        const res = await fetch(`/api/followup?${params.toString()}`)
        const data = (await res.json()) as FollowupsApiResponse

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to load follow-ups.')
        }

        setTabState((prev) => ({
          ...prev,
          [tab]: {
            items: Array.isArray(data.data) ? data.data : [],
            page: data.pagination?.page ?? page,
            totalPages: Math.max(1, data.pagination?.totalPages ?? 1),
            total: data.pagination?.total ?? 0,
            loading: false,
            loaded: true,
            error: null,
          },
        }))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load follow-ups.'
        setTabState((prev) => ({
          ...prev,
          [tab]: {
            ...prev[tab],
            loading: false,
            loaded: true,
            error: message,
            items: [],
            total: 0,
            totalPages: 1,
            page,
          },
        }))
      }
    },
    [buildQuery, tabState],
  )

  useEffect(() => {
    fetchMeCached()
      .then((data) => setCurrentUserId(data.id ?? null))
      .catch((error) => console.error('Error fetching current user:', error))
  }, [])

  useEffect(() => {
    const state = tabState[activeTab]
    if (!state.loaded && !state.loading) {
      loadTab(activeTab, 1)
    }
  }, [activeTab, loadTab, tabState])

  const openCompleteModal = (followup: FollowUp) => {
    setSelectedFollowup(followup)
    setCompletionNote('')
    setCompleteError(null)
    setCompleteOpen(true)
  }

  const invalidateAndRefresh = useCallback(async () => {
    setTabState(createInitialTabState())
    await loadTab(activeTab, 1, true)
  }, [activeTab, loadTab])

  const handleCompleteFollowup = async () => {
    if (!selectedFollowup) return
    if (!currentUserId) {
      setCompleteError('Unable to determine your user id.')
      return
    }
    if (!completionNote.trim()) {
      setCompleteError('Please add completion notes.')
      return
    }

    const nextStatus: FollowUpStatus = selectedFollowup.status === 'MISSED' ? 'LATELY_DONE' : 'DONE'

    setCompleting(true)
    setCompleteError(null)
    try {
      const res = await fetch(`/api/followup/${selectedFollowup.leadId}/${selectedFollowup.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          notes: completionNote.trim(),
          userId: currentUserId,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete follow-up.')
      }

      setCompleteOpen(false)
      setSelectedFollowup(null)
      setCompletionNote('')
      await invalidateAndRefresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to complete follow-up.'
      setCompleteError(message)
    } finally {
      setCompleting(false)
    }
  }

  const FollowupCard = ({ followup }: { followup: FollowUp }) => {
    const config = statusConfig[followup.status]
    const followupDateTime = new Date(followup.followupDate)
    const canComplete = followup.status === 'PENDING' || followup.status === 'MISSED'

    return (
      <Card className="hover:shadow-md transition-shadow duration-200 border-border">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 mt-1 p-2 rounded-lg ${config.bgColor}`}>
              <div className={config.color}>{config.icon}</div>
            </div>

            <div className="flex-1 min-w-0">
              <Link href={`/crm/jr/leads/${followup.leadId}`} className="group">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {followup.lead.name}
                </h3>
              </Link>
              <div className="flex flex-col md:flex-row md:items-center gap-2 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="truncate">{followup.lead.email}</span>
                </div>
                <div className="hidden md:block">•</div>
                <div className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{followup.lead.phone}</span>
                </div>
              </div>

              {followup.notes ? (
                <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{followup.notes}</p>
              ) : null}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {followupDateTime.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      at{' '}
                      {followupDateTime.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <User className="w-3.5 h-3.5" />
                    <span>{followup.assignedTo.fullName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/crm/jr/leads/${followup.leadId}`}>
                    <Button size="sm" variant="outline" className="gap-1">
                      View <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                  {canComplete ? (
                    <Button size="sm" onClick={() => openCompleteModal(followup)}>
                      Complete
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex-shrink-0">
              <Badge className={`${config.bgColor} ${config.color} text-xs font-medium`}>
                {config.label}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const FollowupCardSkeleton = () => (
    <Card className="border-border animate-pulse">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-4">
          <div className="h-8 w-8 rounded-lg bg-muted" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-44 rounded bg-muted" />
            <div className="h-3 w-56 rounded bg-muted" />
            <div className="h-3 w-48 rounded bg-muted" />
            <div className="h-9 w-full rounded bg-muted" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const EmptyState = ({ icon, text }: { icon: ReactNode; text: string }) => (
    <Card className="border-dashed">
      <CardContent className="pt-14 pb-14 text-center">
        <div className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40">{icon}</div>
        <p className="text-muted-foreground text-sm font-medium">{text}</p>
      </CardContent>
    </Card>
  )

  const renderTabContent = (tab: TabKey, emptyIcon: ReactNode, emptyText: string) => {
    const state = tabState[tab]

    if (state.loading && state.items.length === 0) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <FollowupCardSkeleton key={idx} />
          ))}
        </div>
      )
    }

    if (state.error) {
      return <p className="text-sm text-destructive">{state.error}</p>
    }

    if (state.items.length === 0) {
      return <EmptyState icon={emptyIcon} text={emptyText} />
    }

    return (
      <div className="space-y-4">
        {state.items.map((followup) => (
          <FollowupCard key={followup.id} followup={followup} />
        ))}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTab(tab, state.page - 1, true)}
            disabled={state.loading || state.page <= 1}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {state.page} of {state.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTab(tab, state.page + 1, true)}
            disabled={state.loading || state.page >= state.totalPages}
            className="gap-1"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <CrmPageHeader
        title="Followups"
        subtitle="Track and manage all your followup tasks"
      />

      <div className="mx-auto max-w-[1440px] px-6 py-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)} className="w-full mt-8">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 mb-8">
            {(['pending', 'today', 'overdue', 'completed', 'missed'] as TabKey[]).map((tab) => (
              <TabsTrigger key={tab} value={tab} className="flex items-center gap-2">
                {tab === 'pending' ? <Clock className="w-4 h-4" /> : null}
                {tab === 'today' ? <Calendar className="w-4 h-4" /> : null}
                {tab === 'overdue' ? <AlertCircle className="w-4 h-4" /> : null}
                {tab === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : null}
                {tab === 'missed' ? <AlertCircle className="w-4 h-4" /> : null}
                <span>{tabLabels[tab]}</span>
                <Badge variant="secondary" className="ml-auto text-[10px] px-2 py-0">
                  {tabState[tab].total}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {renderTabContent('pending', <Clock className="w-12 h-12" />, 'No pending followups')}
          </TabsContent>
          <TabsContent value="today" className="space-y-4">
            {renderTabContent('today', <Calendar className="w-12 h-12" />, 'No followups for today')}
          </TabsContent>
          <TabsContent value="overdue" className="space-y-4">
            {renderTabContent('overdue', <CheckCircle2 className="w-12 h-12" />, 'No overdue followups')}
          </TabsContent>
          <TabsContent value="completed" className="space-y-4">
            {renderTabContent('completed', <CheckCircle2 className="w-12 h-12" />, 'No completed followups')}
          </TabsContent>
          <TabsContent value="missed" className="space-y-4">
            {renderTabContent('missed', <AlertCircle className="w-12 h-12" />, 'No missed followups')}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete follow-up</DialogTitle>
            <DialogDescription>
              {selectedFollowup?.status === 'MISSED'
                ? 'This follow-up will be marked as lately done.'
                : 'This follow-up will be marked as done.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={completionNote}
              onChange={(event) => setCompletionNote(event.target.value)}
              placeholder="Follow-up finished successfully"
              rows={4}
            />
            {completeError ? <p className="text-sm text-destructive">{completeError}</p> : null}
          </div>
          <DialogFooter>
            <Button onClick={handleCompleteFollowup} disabled={completing}>
              {completing ? 'Saving...' : 'Complete follow-up'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
