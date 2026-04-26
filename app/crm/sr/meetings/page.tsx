'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Clock, Sparkles } from 'lucide-react'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

type CalendarMode = 'MONTHLY' | 'YEARLY'

const WEEKDAY_LABELS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MAX_AGENDA_ITEMS = 10

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
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('MONTHLY')
  const [myLeadsOnly, setMyLeadsOnly] = useState(initialMyLeadsOnly)
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)
  const [selectedYearMonth, setSelectedYearMonth] = useState<number | null>(today.getMonth())

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
            ...tasksPayload.data.filter((task) => task.status !== 'CANCELLED').map(toDeadlineMeeting),
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

  const monthDays = useMemo(
    () => buildMonthGrid(focusDate.getFullYear(), focusDate.getMonth()),
    [focusDate],
  )

  const monthMeetings = useMemo(() => {
    const from = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1)
    const to = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0, 23, 59, 59, 999)
    return meetings
      .filter((meeting) => meeting.start >= from && meeting.start <= to)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [focusDate, meetings])

  const yearMeetings = useMemo(() => {
    return meetings
      .filter((meeting) => meeting.start.getFullYear() === focusDate.getFullYear())
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [focusDate, meetings])

  const monthlySideMeetings = useMemo(() => {
    if (selectedDayKey) {
      return meetingsByDay.get(selectedDayKey) ?? []
    }
    const now = new Date()
    return monthMeetings.filter((meeting) => meeting.end >= now).slice(0, MAX_AGENDA_ITEMS)
  }, [meetingsByDay, monthMeetings, selectedDayKey])

  const yearlySideMeetings = useMemo(() => {
    if (selectedYearMonth !== null) {
      return yearMeetings.filter((meeting) => meeting.start.getMonth() === selectedYearMonth)
    }
    const now = new Date()
    return yearMeetings.filter((meeting) => meeting.end >= now).slice(0, MAX_AGENDA_ITEMS)
  }, [selectedYearMonth, yearMeetings])

  const sideMeetings = calendarMode === 'MONTHLY' ? monthlySideMeetings : yearlySideMeetings

  const sideTitle = useMemo(() => {
    if (calendarMode === 'MONTHLY') {
      if (selectedDayKey) {
        const [year, month, day] = selectedDayKey.split('-').map(Number)
        return `Items on ${new Date(year, month - 1, day).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}`
      }
      return 'Upcoming This Month'
    }

    if (selectedYearMonth !== null) {
      return `${MONTH_LABELS[selectedYearMonth]} ${focusDate.getFullYear()} Items`
    }
    return `Upcoming ${focusDate.getFullYear()}`
  }, [calendarMode, focusDate, selectedDayKey, selectedYearMonth])

  const jumpToToday = () => {
    setFocusDate(today)
    setSelectedYearMonth(today.getMonth())
  }

  const goPrev = () => {
    if (calendarMode === 'MONTHLY') {
      setFocusDate((current) => addMonths(current, -1))
      return
    }
    setFocusDate((current) => addMonths(current, -12))
  }

  const goNext = () => {
    if (calendarMode === 'MONTHLY') {
      setFocusDate((current) => addMonths(current, 1))
      return
    }
    setFocusDate((current) => addMonths(current, 12))
  }

  const goToEventLead = (meeting: Meeting) => {
    router.push(`/crm/sr/leads/${meeting.leadId}`)
  }

  const periodLabel =
    calendarMode === 'MONTHLY'
      ? focusDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : String(focusDate.getFullYear())

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gradient-to-b from-background via-background to-muted/20">
      <CrmPageHeader title={title} subtitle={subtitle} />

      <main className="mx-auto flex w-full max-w-[1520px] min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-6 sm:py-4">
        <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur">
          <CardContent className="py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={goPrev}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goNext}>
                  <ChevronRight className="size-4" />
                </Button>
                <Button size="sm" onClick={jumpToToday}>
                  Today
                </Button>
                <Badge className="h-8 border border-primary/20 bg-primary/10 px-3 text-primary">
                  {periodLabel}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Tabs
                  value={calendarMode}
                  onValueChange={(value) => setCalendarMode(value as CalendarMode)}
                >
                  <TabsList className="grid w-[220px] grid-cols-2">
                    <TabsTrigger value="MONTHLY">Monthly</TabsTrigger>
                    <TabsTrigger value="YEARLY">Yearly</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Badge variant="secondary" className="h-8 gap-1 px-3">
                  <Sparkles className="size-3.5" />
                  {calendarMode === 'MONTHLY' ? monthMeetings.length : yearMeetings.length} items
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

        <div className="mt-4 grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-h-0 min-w-0">
            <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/80 shadow-sm">
              <CardHeader className="border-b border-border/70 bg-muted/20 pb-3 pt-4">
                <CardTitle className="text-base sm:text-lg">
                  {calendarMode === 'MONTHLY' ? 'Monthly Calendar' : 'Yearly Calendar'}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
                {meetingError ? (
                  <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {meetingError}
                  </div>
                ) : null}

                {calendarMode === 'MONTHLY' ? (
                  <>
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
                        const dayKey = formatDayKey(day)
                        const inCurrentMonth = day.getMonth() === focusDate.getMonth()
                        const dayEvents = meetingsByDay.get(dayKey) ?? []
                        const taskCount = dayEvents.filter((event) => event.source === 'TASK').length
                        const meetingCount = dayEvents.length - taskCount
                        const dayIsToday = isSameDay(day, today)
                        const isSelected = selectedDayKey === dayKey

                        return (
                          <button
                            key={dayKey}
                            type="button"
                            onClick={() => setSelectedDayKey((current) => (current === dayKey ? null : dayKey))}
                            className={`flex min-h-0 flex-col rounded-xl border p-2 text-left transition ${
                              isSelected
                                ? 'border-primary/50 bg-primary/10'
                                : dayIsToday
                                  ? 'border-primary/35 bg-gradient-to-b from-primary/10 to-background'
                                  : 'border-border/70 bg-background hover:border-primary/30'
                            }`}
                          >
                            <div className="mb-1 flex items-center justify-between">
                              <span
                                className={`text-xs font-semibold ${
                                  inCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
                                } ${dayIsToday ? 'text-primary' : ''}`}
                              >
                                {day.getDate()}
                              </span>
                              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {dayEvents.length}
                              </span>
                            </div>
                            <div className="mt-auto space-y-1 text-[10px] text-muted-foreground">
                              <p>Tasks: {taskCount}</p>
                              <p>Meetings: {meetingCount}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {MONTH_LABELS.map((monthLabel, monthIndex) => {
                      const monthCells = buildMonthGrid(focusDate.getFullYear(), monthIndex)
                      const monthItems = yearMeetings.filter((meeting) => meeting.start.getMonth() === monthIndex)
                      const monthTaskCount = monthItems.filter((meeting) => meeting.source === 'TASK').length
                      const isSelectedMonth = selectedYearMonth === monthIndex

                      return (
                        <button
                          key={monthLabel}
                          type="button"
                          onClick={() => setSelectedYearMonth((current) => (current === monthIndex ? null : monthIndex))}
                          className={`flex min-h-0 flex-col rounded-xl border p-2 text-left transition ${
                            isSelectedMonth
                              ? 'border-primary/45 bg-primary/10'
                              : 'border-border/70 bg-background hover:border-primary/30'
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-sm font-semibold text-foreground">{monthLabel}</p>
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {monthItems.length}
                            </span>
                          </div>
                          <p className="mb-2 text-[10px] text-muted-foreground">Tasks: {monthTaskCount}</p>
                          <div className="grid grid-cols-7 gap-1 text-[9px]">
                            {monthCells.map((day) => {
                              const dayCount = meetingsByDay.get(formatDayKey(day))?.length ?? 0
                              const inMonth = day.getMonth() === monthIndex
                              return (
                                <div
                                  key={`${monthLabel}-${formatDayKey(day)}`}
                                  className={`rounded border px-1 py-0.5 text-center ${
                                    inMonth
                                      ? 'border-border/60 text-foreground'
                                      : 'border-transparent text-muted-foreground'
                                  } ${dayCount > 0 ? 'bg-primary/10 text-primary border-primary/20' : ''}`}
                                >
                                  {day.getDate()}
                                </div>
                              )
                            })}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <aside className="hidden min-h-0 xl:block">
            <Card className="flex h-full min-h-0 flex-col border-border/80 bg-card/90 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{sideTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 overflow-y-auto">
                {loadingMeetings ? (
                  <p className="text-sm text-muted-foreground">Loading meetings...</p>
                ) : sideMeetings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items in this selection.</p>
                ) : (
                  sideMeetings.slice(0, 60).map((meeting) => (
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
    </div>
  )
}

export default function SeniorCrmMeetingsPage() {
  return <SeniorCrmMeetingsView />
}
