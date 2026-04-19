'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import {
  MapPin,
  Clock,
  Calendar,
  CheckCircle2,
  Search,
  History,
  TrendingUp,
  CalendarDays,
  Users,
  Ban,
  Target,
} from 'lucide-react'
import { toast } from 'sonner'

type VisitStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED'

type VisitRecord = {
  id: string
  scheduledAt: string
  location: string
  notes: string | null
  status: VisitStatus
  projectSqft?: number | null
  projectStatus?: string | null
  lead: {
    id: string
    name: string
    phone: string
    location: string | null
  }
  assignedTo: {
    id: string
    fullName: string
    email: string
    phone: string
  } | null
}

type ApiResponse = {
  success: boolean
  data?: VisitRecord[]
}

type VisitDatePreset =
  | 'TODAY'
  | 'PREVIOUS_DAY'
  | 'THIS_MONTH'
  | 'LAST_7_DAYS'
  | 'LAST_MONTH'
  | 'LIFETIME'
  | 'CUSTOM'

type VisitHistoryViewProps = {
  mode: 'lead' | 'support'
  title: string
  subtitle: string
  emptyPastText: string
  emptyUpcomingText: string
  enableJrAssignAction?: boolean
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatVisitStatusLabel(status: VisitStatus) {
  return status === 'SCHEDULED' ? 'PENDING' : status
}

function getStatusBadgeClass(status: VisitStatus) {
  if (status === 'SCHEDULED') return 'bg-primary/10 text-primary border-primary/20'
  if (status === 'COMPLETED') return 'bg-success/10 text-success border-success/20'
  if (status === 'RESCHEDULED') return 'bg-warning/10 text-warning-foreground border-warning/20'
  return 'bg-destructive/10 text-destructive border-destructive/20'
}

function getMonthKey(value: string) {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getMonthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getVisitDateKey(value: string) {
  const visitDate = new Date(value)
  return formatDateInput(visitDate)
}

function getPresetRange(preset: VisitDatePreset): { from: string; to: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (preset === 'TODAY') {
    const day = formatDateInput(today)
    return { from: day, to: day }
  }

  if (preset === 'PREVIOUS_DAY') {
    const previous = new Date(today)
    previous.setDate(previous.getDate() - 1)
    const day = formatDateInput(previous)
    return { from: day, to: day }
  }

  if (preset === 'LAST_7_DAYS') {
    const from = new Date(today)
    from.setDate(from.getDate() - 6)
    return { from: formatDateInput(from), to: formatDateInput(today) }
  }

  if (preset === 'THIS_MONTH') {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return { from: formatDateInput(firstDay), to: formatDateInput(lastDay) }
  }

  if (preset === 'LAST_MONTH') {
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0)
    return { from: formatDateInput(firstDay), to: formatDateInput(lastDay) }
  }

  return { from: '', to: '' }
}

function getPresetLabel(preset: VisitDatePreset) {
  if (preset === 'TODAY') return 'Today'
  if (preset === 'PREVIOUS_DAY') return 'Previous Day'
  if (preset === 'THIS_MONTH') return 'This Month'
  if (preset === 'LAST_7_DAYS') return 'Last 7 Days'
  if (preset === 'LAST_MONTH') return 'Last Month'
  if (preset === 'LIFETIME') return 'Lifetime'
  return 'Custom'
}

function VisitRecordCard({
  visit,
  enableJrAssignAction,
  jrArchitectUsers,
  selectedJrArchitectUserId,
  assigning,
  onSelectJrArchitect,
  onAssignJrArchitect,
}: {
  visit: VisitRecord
  enableJrAssignAction: boolean
  jrArchitectUsers: Array<{ id: string; fullName: string }>
  selectedJrArchitectUserId: string
  assigning: boolean
  onSelectJrArchitect: (leadId: string, userId: string) => void
  onAssignJrArchitect: (leadId: string) => void
}) {
  const canAssignFromVisit = enableJrAssignAction && visit.status === 'COMPLETED'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-border bg-card">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-base font-semibold text-foreground">{visit.lead.name}</p>
                <Badge variant="outline" className={getStatusBadgeClass(visit.status)}>
                  {formatVisitStatusLabel(visit.status)}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3.5" />
                  {formatDate(visit.scheduledAt)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {formatTime(visit.scheduledAt)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  <span className="min-w-0 break-words">{visit.location}</span>
                </span>
              </div>
              {visit.notes ? (
                <p className="text-xs text-muted-foreground line-clamp-2">{visit.notes}</p>
              ) : null}
              {visit.projectSqft || visit.projectStatus ? (
                <p className="text-xs text-muted-foreground">
                  {visit.projectSqft ? `Sqft: ${visit.projectSqft}` : ''}
                  {visit.projectSqft && visit.projectStatus ? ' | ' : ''}
                  {visit.projectStatus ? `Status: ${visit.projectStatus.replace(/_/g, ' ')}` : ''}
                </p>
              ) : null}
            </div>
            <Button size="sm" variant="outline" asChild className="w-full sm:w-auto">
              <Link href={`/visit-team/leads/${visit.lead.id}`}>Open Lead</Link>
            </Button>
          </div>
          {canAssignFromVisit ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Select
                value={selectedJrArchitectUserId}
                onValueChange={(value) => onSelectJrArchitect(visit.lead.id, value)}
              >
                <SelectTrigger>
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
                disabled={assigning || !selectedJrArchitectUserId}
                onClick={() => onAssignJrArchitect(visit.lead.id)}
              >
                {assigning ? 'Assigning...' : 'Assign JR Architect'}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function VisitHistoryView({
  mode,
  title,
  subtitle,
  emptyPastText,
  emptyUpcomingText,
  enableJrAssignAction = false,
}: VisitHistoryViewProps) {
  const [visits, setVisits] = useState<VisitRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<'api' | 'fallback'>('api')
  const [statusFilter, setStatusFilter] = useState<'ALL' | VisitStatus>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [datePreset, setDatePreset] = useState<VisitDatePreset>('THIS_MONTH')
  const [activeTab, setActiveTab] = useState<'overview' | 'upcoming' | 'history'>('overview')
  const overviewRef = useRef<HTMLDivElement | null>(null)
  const upcomingRef = useRef<HTMLDivElement | null>(null)
  const historyRef = useRef<HTMLDivElement | null>(null)
  const initialRange = useMemo(() => getPresetRange('THIS_MONTH'), [])
  const [visitDateFrom, setVisitDateFrom] = useState(initialRange.from)
  const [visitDateTo, setVisitDateTo] = useState(initialRange.to)
  const [jrArchitectUsers, setJrArchitectUsers] = useState<Array<{ id: string; fullName: string }>>([])
  const [selectedJrByLead, setSelectedJrByLead] = useState<Record<string, string>>({})
  const [assigningLeadId, setAssigningLeadId] = useState<string | null>(null)

  useEffect(() => {
    const loadVisits = async () => {
      try {
        const visitsRes = await fetch(`/api/visit-schedule?mode=${mode}`)

        if (!visitsRes.ok) {
          throw new Error('Unable to fetch visit schedule')
        }

        const payload = (await visitsRes.json()) as ApiResponse
        const data = payload.data ?? []

        setVisits(data)
        setSource('api')
      } catch {
        setVisits([])
        setSource('fallback')
      } finally {
        setLoading(false)
      }
    }

    loadVisits()
  }, [mode])

  useEffect(() => {
    if (!enableJrAssignAction) return

    let cancelled = false

    const loadJrArchitects = async () => {
      try {
        const response = await fetch('/api/visit-complete-queue', { cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok || !payload?.success || !Array.isArray(payload?.jrArchitectUsers)) return

        if (!cancelled) {
          const users = payload.jrArchitectUsers
            .filter((user: { id?: unknown; fullName?: unknown }) =>
              typeof user?.id === 'string' && typeof user?.fullName === 'string',
            )
            .map((user: { id: string; fullName: string }) => ({
              id: user.id,
              fullName: user.fullName,
            }))

          setJrArchitectUsers(users)
          setSelectedJrByLead((prev) => {
            const next = { ...prev }
            for (const visit of visits) {
              if (!next[visit.lead.id] && users[0]?.id) {
                next[visit.lead.id] = users[0].id
              }
            }
            return next
          })
        }
      } catch {
        // no-op; assignment button will just remain unusable
      }
    }

    loadJrArchitects()

    return () => {
      cancelled = true
    }
  }, [enableJrAssignAction, visits])

  const assignJrArchitectFromVisit = async (leadId: string) => {
    const jrArchitectUserId = selectedJrByLead[leadId]
    if (!jrArchitectUserId) {
      toast.error('Select a JR Architect first')
      return
    }

    setAssigningLeadId(leadId)
    try {
      const response = await fetch('/api/visit-complete-queue/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, jrArchitectUserId }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? 'Failed to assign JR Architect')
      }
      toast.success(payload?.message ?? 'JR Architect assigned')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign JR Architect')
    } finally {
      setAssigningLeadId(null)
    }
  }

  const normalizedSearch = searchTerm.trim().toLowerCase()

  const filteredVisits = useMemo(() => {
    const dateFiltered = visits.filter((visit) => {
      const visitDate = getVisitDateKey(visit.scheduledAt)
      if (visitDateFrom && visitDate < visitDateFrom) return false
      if (visitDateTo && visitDate > visitDateTo) return false
      return true
    })

    const statusFiltered =
      statusFilter === 'ALL'
        ? dateFiltered
        : dateFiltered.filter((visit) => visit.status === statusFilter)

    if (!normalizedSearch) return statusFiltered

    return statusFiltered.filter((visit) => {
      const leadName = visit.lead.name.toLowerCase()
      const location = (visit.location || '').toLowerCase()
      const phone = (visit.lead.phone || '').toLowerCase()
      return (
        leadName.includes(normalizedSearch) ||
        location.includes(normalizedSearch) ||
        phone.includes(normalizedSearch)
      )
    })
  }, [normalizedSearch, statusFilter, visitDateFrom, visitDateTo, visits])

  const sortedVisits = useMemo(
    () =>
      [...filteredVisits].sort(
        (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
      ),
    [filteredVisits],
  )

  const stats = useMemo(() => {
    const total = visits.length
    const completed = visits.filter((visit) => visit.status === 'COMPLETED').length
    const cancelled = visits.filter((visit) => visit.status === 'CANCELLED').length
    const upcoming = visits.filter((visit) => {
      if (visit.status === 'CANCELLED') return false
      return new Date(visit.scheduledAt).getTime() >= Date.now()
    }).length
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    return {
      total,
      completed,
      cancelled,
      upcoming,
      completionRate,
    }
  }, [visits])

  const groupedByMonth = useMemo(() => {
    const grouped: Record<string, VisitRecord[]> = {}
    sortedVisits.forEach((visit) => {
      const key = getMonthKey(visit.scheduledAt)
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(visit)
    })

    return Object.entries(grouped).sort(([a], [b]) => (a < b ? 1 : -1))
  }, [sortedVisits])

  const upcomingVisits = useMemo(
    () =>
      sortedVisits.filter((visit) => {
        if (visit.status === 'CANCELLED') return false
        return new Date(visit.scheduledAt).getTime() >= Date.now()
      }),
    [sortedVisits],
  )

  const recentHistory = useMemo(
    () => sortedVisits.filter((visit) => new Date(visit.scheduledAt).getTime() < Date.now()),
    [sortedVisits],
  )

  const totalLabel = mode === 'support' ? 'Total Supports' : 'Total Visits'

  const scrollToTabData = (tab: 'overview' | 'upcoming' | 'history') => {
    requestAnimationFrame(() => {
      const target =
        tab === 'overview'
          ? overviewRef.current
          : tab === 'upcoming'
            ? upcomingRef.current
            : historyRef.current
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const focusTotal = () => {
    setStatusFilter('ALL')
    setActiveTab('overview')
    scrollToTabData('overview')
  }

  const focusUpcoming = () => {
    setStatusFilter('ALL')
    setActiveTab('upcoming')
    scrollToTabData('upcoming')
  }

  const focusCompleted = () => {
    setStatusFilter('COMPLETED')
    setActiveTab('history')
    scrollToTabData('history')
  }

  const focusCancelled = () => {
    setStatusFilter('CANCELLED')
    setActiveTab('history')
    scrollToTabData('history')
  }

  return (
    <div className="min-h-screen bg-card">
      <CrmPageHeader title={title} subtitle={subtitle} />

      <main className="mx-auto max-w-[1440px] overflow-x-hidden px-4 py-6 sm:px-6">
        <div className="space-y-6">
          <div className="flex justify-end">
            <Badge variant={source === 'api' ? 'secondary' : 'outline'}>
              {source === 'api' ? 'Live Data' : 'Fallback Data'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Card
              role="button"
              tabIndex={0}
              onClick={focusTotal}
              onKeyDown={(event) => event.key === 'Enter' && focusTotal()}
              className="cursor-pointer transition hover:border-primary/40"
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{totalLabel}</p>
                  <p className="text-xl font-semibold text-foreground">{stats.total}</p>
                </div>
                <Users className="size-4 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card
              role="button"
              tabIndex={0}
              onClick={focusUpcoming}
              onKeyDown={(event) => event.key === 'Enter' && focusUpcoming()}
              className="cursor-pointer transition hover:border-primary/40"
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Upcoming</p>
                  <p className="text-xl font-semibold text-foreground">{stats.upcoming}</p>
                </div>
                <Calendar className="size-4 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card
              role="button"
              tabIndex={0}
              onClick={focusCompleted}
              onKeyDown={(event) => event.key === 'Enter' && focusCompleted()}
              className="cursor-pointer transition hover:border-primary/40"
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-xl font-semibold text-foreground">{stats.completed}</p>
                </div>
                <CheckCircle2 className="size-4 text-success" />
              </CardContent>
            </Card>
            <Card
              role="button"
              tabIndex={0}
              onClick={focusCancelled}
              onKeyDown={(event) => event.key === 'Enter' && focusCancelled()}
              className="cursor-pointer transition hover:border-primary/40"
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Cancelled</p>
                  <p className="text-xl font-semibold text-foreground">{stats.cancelled}</p>
                </div>
                <Ban className="size-4 text-destructive" />
              </CardContent>
            </Card>
            <Card
              role="button"
              tabIndex={0}
              onClick={focusCompleted}
              onKeyDown={(event) => event.key === 'Enter' && focusCompleted()}
              className="col-span-2 cursor-pointer transition hover:border-primary/40 md:col-span-1"
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Completion Rate</p>
                  <p className="text-xl font-semibold text-foreground">{stats.completionRate}%</p>
                </div>
                <Target className="size-4 text-primary" />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4 lg:items-center">
            <div className="lg:col-span-2 relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by lead name, phone, or location"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="SCHEDULED">Pending</SelectItem>
                <SelectItem value="RESCHEDULED">Rescheduled</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 w-full justify-start text-left font-normal">
                  <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">Visit Date: {getPresetLabel(datePreset)}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[320px]">
                <div className="space-y-3">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground">VISIT DATE</p>

                  <div className="flex flex-wrap gap-2">
                    {(
                      ['TODAY', 'PREVIOUS_DAY', 'THIS_MONTH', 'LAST_7_DAYS', 'LAST_MONTH', 'LIFETIME'] as VisitDatePreset[]
                    ).map((preset) => (
                      <Button
                        key={preset}
                        type="button"
                        size="sm"
                        variant={datePreset === preset ? 'default' : 'outline'}
                        className="h-7 px-2.5 text-xs"
                        onClick={() => {
                          setDatePreset(preset)
                          const range = getPresetRange(preset)
                          setVisitDateFrom(range.from)
                          setVisitDateTo(range.to)
                        }}
                      >
                        {getPresetLabel(preset)}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant={datePreset === 'CUSTOM' ? 'default' : 'outline'}
                      className="h-7 px-2.5 text-xs"
                      onClick={() => setDatePreset('CUSTOM')}
                    >
                      Custom
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={visitDateFrom}
                      onChange={(event) => {
                        setDatePreset('CUSTOM')
                        setVisitDateFrom(event.target.value)
                      }}
                    />
                    <Input
                      type="date"
                      value={visitDateTo}
                      onChange={(event) => {
                        setDatePreset('CUSTOM')
                        setVisitDateTo(event.target.value)
                      }}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {loading ? <div className="text-sm text-muted-foreground">Loading visits...</div> : null}

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="w-full overflow-x-hidden">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview" className="gap-1.5 shrink-0">
                <TrendingUp className="size-3.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="gap-1.5 shrink-0">
                <Calendar className="size-3.5" />
                Upcoming ({upcomingVisits.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 shrink-0">
                <History className="size-3.5" />
                Lifetime Timeline
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4" ref={overviewRef}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Recent Visit Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                    {recentHistory.slice(0, 8).map((visit) => (
                      <VisitRecordCard
                        key={visit.id}
                        visit={visit}
                        enableJrAssignAction={enableJrAssignAction}
                        jrArchitectUsers={jrArchitectUsers}
                        selectedJrArchitectUserId={selectedJrByLead[visit.lead.id] ?? ''}
                        assigning={assigningLeadId === visit.lead.id}
                        onSelectJrArchitect={(leadId, userId) =>
                          setSelectedJrByLead((prev) => ({ ...prev, [leadId]: userId }))
                        }
                        onAssignJrArchitect={assignJrArchitectFromVisit}
                      />
                    ))}
                  </div>
                  {recentHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{emptyPastText}</p>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="upcoming" className="mt-4" ref={upcomingRef}>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {upcomingVisits.map((visit) => (
                  <VisitRecordCard
                    key={visit.id}
                    visit={visit}
                    enableJrAssignAction={enableJrAssignAction}
                    jrArchitectUsers={jrArchitectUsers}
                    selectedJrArchitectUserId={selectedJrByLead[visit.lead.id] ?? ''}
                    assigning={assigningLeadId === visit.lead.id}
                    onSelectJrArchitect={(leadId, userId) =>
                      setSelectedJrByLead((prev) => ({ ...prev, [leadId]: userId }))
                    }
                    onAssignJrArchitect={assignJrArchitectFromVisit}
                  />
                ))}
              </div>
              {upcomingVisits.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground">{emptyUpcomingText}</CardContent>
                </Card>
              ) : null}
            </TabsContent>

            <TabsContent value="history" className="space-y-6 mt-4" ref={historyRef}>
              {groupedByMonth.map(([monthKey, monthVisits]) => (
                <div key={monthKey} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">{getMonthLabel(monthKey)}</h3>
                    <Badge variant="outline">{monthVisits.length} visits</Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                    {monthVisits.map((visit) => (
                      <VisitRecordCard
                        key={visit.id}
                        visit={visit}
                        enableJrAssignAction={enableJrAssignAction}
                        jrArchitectUsers={jrArchitectUsers}
                        selectedJrArchitectUserId={selectedJrByLead[visit.lead.id] ?? ''}
                        assigning={assigningLeadId === visit.lead.id}
                        onSelectJrArchitect={(leadId, userId) =>
                          setSelectedJrByLead((prev) => ({ ...prev, [leadId]: userId }))
                        }
                        onAssignJrArchitect={assignJrArchitectFromVisit}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {groupedByMonth.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground">No visit records found.</CardContent>
                </Card>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
