'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Clock, Sparkles } from 'lucide-react'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'

type Meeting = {
  id: string
  leadId: string
  title: string
  leadName: string
  start: Date
  end: Date
  source: 'MEETING' | 'TASK'
  taskStatus?: 'OPEN' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED'
  type: 'FIRST_MEETING' | 'BUDGET_MEETING' | 'REVIEW_CHECKPOINT'
}

const WEEKDAY_LABELS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const MAX_DAY_EVENTS = 2
const MAX_AGENDA_ITEMS = 8

function startOfDay(date: Date) {
  const clone = new Date(date)
  clone.setHours(0, 0, 0, 0)
  return clone
}

function addDays(date: Date, days: number) {
  const clone = new Date(date)
  clone.setDate(clone.getDate() + days)
  return clone
}

function addMonths(date: Date, months: number) {
  const clone = new Date(date)
  clone.setMonth(clone.getMonth() + months)
  return clone
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

function getStartOfSaturdayWeek(date: Date) {
  const dayIndex = date.getDay()
  const distanceFromSaturday = dayIndex === 6 ? 0 : dayIndex + 1
  return startOfDay(addDays(date, -distanceFromSaturday))
}

function buildMonthGrid(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1)
  const firstWeekStart = getStartOfSaturdayWeek(first)

  const cells: Date[] = []
  for (let index = 0; index < 42; index += 1) {
    cells.push(addDays(firstWeekStart, index))
  }
  return cells
}

function getTypeClass(type: Meeting['type']) {
  if (type === 'FIRST_MEETING') {
    return 'border-blue-200 bg-blue-50/80 text-blue-700 dark:border-blue-800/70 dark:bg-blue-950/30 dark:text-blue-200'
  }
  if (type === 'BUDGET_MEETING') {
    return 'border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-200'
  }
  return 'border-violet-200 bg-violet-50/80 text-violet-700 dark:border-violet-800/70 dark:bg-violet-950/30 dark:text-violet-200'
}

function getEventClass(event: Meeting) {
  if (event.source === 'TASK') {
    if (event.taskStatus === 'COMPLETED') {
      return 'border-green-200 bg-green-50/80 text-green-700 dark:border-green-800/70 dark:bg-green-950/30 dark:text-green-200'
    }
    if (event.taskStatus === 'IN_REVIEW') {
      return 'border-indigo-200 bg-indigo-50/80 text-indigo-700 dark:border-indigo-800/70 dark:bg-indigo-950/30 dark:text-indigo-200'
    }
    return 'border-amber-200 bg-amber-50/90 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/35 dark:text-amber-200'
  }
  return getTypeClass(event.type)
}

function getEventLabel(event: Meeting): string {
  if (event.source === 'TASK') return 'Task Deadline'
  return event.type.replace(/_/g, ' ')
}

function formatEventTime(value: Date): string {
  return value.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

type MeetingsApiItem = {
  id: string
  type: Meeting['type']
  title: string
  startsAt: string
  endsAt: string | null
  lead: {
    id: string
    name: string
  }
}

type MeetingsApiResponse = {
  success: boolean
  data?: MeetingsApiItem[]
  error?: string
}

type SrTaskApiItem = {
  id: string
  leadId: string
  leadName: string
  phaseType: 'CAD' | 'QUOTATION'
  dueAt: string
  status: 'OPEN' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED'
}

type SrTasksApiResponse = {
  success: boolean
  data?: SrTaskApiItem[]
  error?: string
}

type SeniorCrmMeetingsViewProps = {
  title?: string
  subtitle?: string
  initialMyLeadsOnly?: boolean
  lockMyLeadsOnly?: boolean
}

function toMeeting(item: MeetingsApiItem): Meeting {
  const start = new Date(item.startsAt)
  const end = item.endsAt ? new Date(item.endsAt) : new Date(start.getTime() + 60 * 60 * 1000)
  return {
    id: item.id,
    leadId: item.lead.id,
    title: item.title,
    leadName: item.lead.name,
    source: 'MEETING',
    type: item.type,
    start,
    end,
  }
}

function toDeadlineMeeting(item: SrTaskApiItem): Meeting {
  const start = new Date(item.dueAt)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  return {
    id: `task-${item.id}`,
    leadId: item.leadId,
    title: `${item.phaseType} Deadline`,
    leadName: item.leadName,
    source: 'TASK',
    taskStatus: item.status,
    type: 'REVIEW_CHECKPOINT',
    start,
    end,
  }
}

export function SeniorCrmMeetingsView({
  title = 'Calendar',
  subtitle = 'Calendar view for meetings and Senior CRM task deadlines.',
  initialMyLeadsOnly = true,
  lockMyLeadsOnly = false,
}: SeniorCrmMeetingsViewProps) {
  const router = useRouter()
  const today = useMemo(() => startOfDay(new Date()), [])
  const [focusDate, setFocusDate] = useState(today)
  const [myLeadsOnly, setMyLeadsOnly] = useState(initialMyLeadsOnly)
  const [dayDialogOpen, setDayDialogOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loadingMeetings, setLoadingMeetings] = useState(false)
  const [meetingError, setMeetingError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadMeetings = async () => {
      setLoadingMeetings(true)
      setMeetingError(null)
      try {
        const from = new Date(focusDate.getFullYear(), 0, 1).toISOString()
        const to = new Date(focusDate.getFullYear(), 11, 31, 23, 59, 59, 999).toISOString()
        const response = await fetch(
          `/api/lead/meetings?myLeadsOnly=${myLeadsOnly ? '1' : '0'}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
          { cache: 'no-store' },
        )
        const payload = (await response.json()) as MeetingsApiResponse
        if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
          throw new Error(payload.error ?? 'Failed to load meetings')
        }

        const tasksResponse = await fetch(
          `/api/sr/tasks?myLeadsOnly=${myLeadsOnly ? '1' : '0'}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
          { cache: 'no-store' },
        )
        const tasksPayload = (await tasksResponse.json()) as SrTasksApiResponse
        if (!tasksResponse.ok || !tasksPayload.success || !Array.isArray(tasksPayload.data)) {
          throw new Error(tasksPayload.error ?? 'Failed to load task deadlines')
        }

        if (!cancelled) {
          setMeetings([
            ...payload.data.map(toMeeting),
            ...tasksPayload.data
              .filter((task) => task.status !== 'CANCELLED')
              .map(toDeadlineMeeting),
          ])
        }
      } catch (error) {
        if (!cancelled) {
          setMeetingError(error instanceof Error ? error.message : 'Failed to load meetings')
          setMeetings([])
        }
      } finally {
        if (!cancelled) {
          setLoadingMeetings(false)
        }
      }
    }

    loadMeetings()
    return () => {
      cancelled = true
    }
  }, [focusDate, myLeadsOnly])

  const monthDays = useMemo(
    () => buildMonthGrid(focusDate.getFullYear(), focusDate.getMonth()),
    [focusDate],
  )

  const meetingsByDay = useMemo(() => {
    const grouped = new Map<string, Meeting[]>()
    for (const meeting of meetings) {
      const key = formatDayKey(meeting.start)
      const existing = grouped.get(key) ?? []
      existing.push(meeting)
      grouped.set(key, existing.sort((a, b) => a.start.getTime() - b.start.getTime()))
    }
    return grouped
  }, [meetings])

  const monthMeetings = useMemo(() => {
    const from = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1)
    const to = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0, 23, 59, 59, 999)

    return meetings
      .filter((meeting) => meeting.start >= from && meeting.start <= to)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [focusDate, meetings])

  const upcomingMeetings = useMemo(() => {
    const now = new Date()
    return monthMeetings.filter((meeting) => meeting.end >= now).slice(0, MAX_AGENDA_ITEMS)
  }, [monthMeetings])

  const selectedDayMeetings = useMemo(() => {
    if (!selectedDay) return []
    return meetingsByDay.get(formatDayKey(selectedDay)) ?? []
  }, [meetingsByDay, selectedDay])

  const jumpToToday = () => setFocusDate(today)
  const goPrevMonth = () => setFocusDate((current) => addMonths(current, -1))
  const goNextMonth = () => setFocusDate((current) => addMonths(current, 1))

  const openDayDialog = (day: Date) => {
    setSelectedDay(day)
    setDayDialogOpen(true)
  }

  const goToEventLead = (meeting: Meeting) => {
    router.push(`/crm/sr/leads/${meeting.leadId}`)
  }

  const monthLabel = focusDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gradient-to-b from-background via-background to-muted/20">
      <CrmPageHeader title={title} subtitle={subtitle} />

      <main className="mx-auto flex w-full max-w-[1520px] min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-6 sm:py-4">
        <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur">
          <CardContent className="py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={goPrevMonth}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goNextMonth}>
                  <ChevronRight className="size-4" />
                </Button>
                <Button size="sm" onClick={jumpToToday}>
                  Today
                </Button>
                <Badge className="h-8 border border-primary/20 bg-primary/10 px-3 text-primary">
                  {monthLabel}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="h-8 gap-1 px-3">
                  <Sparkles className="size-3.5" />
                  {monthMeetings.length} items
                </Badge>
                {!lockMyLeadsOnly ? (
                  <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm shadow-sm">
                    <span>My Leads Only</span>
                    <Switch checked={myLeadsOnly} onCheckedChange={setMyLeadsOnly} />
                  </label>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-h-0 min-w-0">
            <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/80 shadow-sm">
              <CardHeader className="border-b border-border/70 bg-muted/20 pb-3 pt-4">
                <CardTitle className="text-base sm:text-lg">Monthly Calendar</CardTitle>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
                {meetingError ? (
                  <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {meetingError}
                  </div>
                ) : null}

                <div className="grid grid-cols-7 gap-2">
                  {WEEKDAY_LABELS.map((label) => (
                    <div
                      key={label}
                      className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {label}
                    </div>
                  ))}
                </div>

                <div className="mt-2 grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-2">
                  {monthDays.map((day) => {
                    const inCurrentMonth = day.getMonth() === focusDate.getMonth()
                    const events = meetingsByDay.get(formatDayKey(day)) ?? []
                    const dayIsToday = isSameDay(day, today)

                    return (
                      <div
                        key={formatDayKey(day)}
                        role="button"
                        tabIndex={0}
                        onClick={() => openDayDialog(day)}
                        onKeyDown={(event) => event.key === 'Enter' && openDayDialog(day)}
                        className={`flex min-h-0 cursor-pointer flex-col rounded-xl border p-2 transition ${
                          dayIsToday
                            ? 'border-primary/45 bg-gradient-to-b from-primary/10 to-background'
                            : 'border-border/70 bg-background hover:border-primary/30'
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <p
                            className={`text-xs font-semibold ${
                              inCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
                            } ${dayIsToday ? 'text-primary' : ''}`}
                          >
                            {day.getDate()}
                          </p>
                          {events.length > 0 ? (
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {events.length}
                            </span>
                          ) : null}
                        </div>

                        <div className="space-y-1">
                          {events.slice(0, MAX_DAY_EVENTS).map((eventItem) => (
                            <button
                              key={eventItem.id}
                              type="button"
                              onClick={(clickEvent) => {
                                clickEvent.stopPropagation()
                                goToEventLead(eventItem)
                              }}
                              className={`w-full rounded-md border px-1.5 py-1 text-left text-[10px] font-medium leading-tight transition hover:opacity-85 ${getEventClass(eventItem)}`}
                            >
                              <p className="truncate">{eventItem.title}</p>
                              <p className="truncate opacity-80">{formatEventTime(eventItem.start)}</p>
                            </button>
                          ))}
                          {events.length > MAX_DAY_EVENTS ? (
                            <p className="text-[10px] font-medium text-muted-foreground">
                              +{events.length - MAX_DAY_EVENTS} more
                            </p>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </section>

          <aside className="hidden min-h-0 xl:block">
            <Card className="flex h-full min-h-0 flex-col border-border/80 bg-card/90 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Upcoming This Month</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {loadingMeetings ? (
                  <p className="text-sm text-muted-foreground">Loading meetings...</p>
                ) : upcomingMeetings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No more upcoming items in this month.</p>
                ) : (
                  upcomingMeetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => goToEventLead(meeting)}
                      onKeyDown={(event) => event.key === 'Enter' && goToEventLead(meeting)}
                      className={`cursor-pointer rounded-lg border p-3 transition hover:border-primary/40 ${getEventClass(meeting)}`}
                    >
                      <p className="text-sm font-semibold text-foreground">{meeting.title}</p>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {getEventLabel(meeting)}
                      </p>
                      <p className="text-xs text-muted-foreground">{meeting.leadName}</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3.5" />
                        {meeting.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })},{' '}
                        {formatEventTime(meeting.start)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedDay
                ? selectedDay.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Day Meetings'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {selectedDayMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No meetings on this day.</p>
            ) : (
              selectedDayMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => goToEventLead(meeting)}
                  onKeyDown={(event) => event.key === 'Enter' && goToEventLead(meeting)}
                  className={`cursor-pointer rounded-md border p-3 transition hover:border-primary/40 ${getEventClass(meeting)}`}
                >
                  <p className="text-sm font-semibold text-foreground">{meeting.title}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {getEventLabel(meeting)}
                  </p>
                  <p className="text-xs text-muted-foreground">{meeting.leadName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatEventTime(meeting.start)} - {formatEventTime(meeting.end)}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SeniorCrmMeetingsPage() {
  return <SeniorCrmMeetingsView />
}
