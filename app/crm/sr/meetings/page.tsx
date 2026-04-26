'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Clock, ListFilter } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

type CalendarView = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

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

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7)
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

function formatHourLabel(hour: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const normalized = hour % 12 === 0 ? 12 : hour % 12
  return `${normalized}:00 ${suffix}`
}

function getTypeClass(type: Meeting['type']) {
  if (type === 'FIRST_MEETING') {
    return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800/70'
  }
  if (type === 'BUDGET_MEETING') {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/70'
  }
  return 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-800/70'
}

function getEventClass(event: Meeting) {
  if (event.source === 'TASK') {
    if (event.taskStatus === 'COMPLETED') {
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-200 dark:border-green-800/70'
    }
    if (event.taskStatus === 'IN_REVIEW') {
      return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-800/70'
    }
    return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/45 dark:text-amber-200 dark:border-amber-800/70'
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

function CompactEventCard({
  event,
  dense = false,
  onClick,
}: {
  event: Meeting
  dense?: boolean
  onClick?: () => void
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (event) => event.key === 'Enter' && onClick() : undefined}
      className={`rounded-md border px-2 py-1.5 leading-tight ${getEventClass(event)} ${
        dense ? 'text-[10px]' : 'text-[11px]'
      } ${onClick ? 'cursor-pointer transition hover:opacity-90' : ''}`}
    >
      <p className="truncate font-semibold">{event.title}</p>
      <p className="truncate text-[10px] opacity-90">{event.leadName}</p>
      <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wide opacity-80">
        {event.source === 'TASK' ? 'Task' : 'Meeting'} - {formatEventTime(event.start)}
      </p>
    </div>
  )
}

function getStartOfSaturdayWeek(date: Date) {
  const dayIndex = date.getDay()
  const distanceFromSaturday = dayIndex === 6 ? 0 : dayIndex + 1
  return startOfDay(addDays(date, -distanceFromSaturday))
}

function buildMonthGrid(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1)
  const last = new Date(year, monthIndex + 1, 0)
  const firstWeekStart = getStartOfSaturdayWeek(first)
  const lastWeekEnd = addDays(getStartOfSaturdayWeek(last), 6)

  const cells: Date[] = []
  for (let cursor = firstWeekStart; cursor <= lastWeekEnd; cursor = addDays(cursor, 1)) {
    cells.push(new Date(cursor))
  }
  return cells
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
  const [view, setView] = useState<CalendarView>('MONTHLY')
  const [showAgenda, setShowAgenda] = useState(true)
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

  const weeklyDays = useMemo(() => {
    const start = getStartOfSaturdayWeek(focusDate)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [focusDate])

  const monthDays = useMemo(
    () => buildMonthGrid(focusDate.getFullYear(), focusDate.getMonth()),
    [focusDate],
  )

  const quarterMonths = useMemo(() => {
    const quarterStart = Math.floor(focusDate.getMonth() / 3) * 3
    return [quarterStart, quarterStart + 1, quarterStart + 2]
  }, [focusDate])

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

  const visibleMeetings = useMemo(() => {
    let from = startOfDay(focusDate)
    let to = startOfDay(focusDate)

    if (view === 'WEEKLY') {
      from = weeklyDays[0]
      to = weeklyDays[6]
    } else if (view === 'MONTHLY') {
      from = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1)
      to = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0)
    } else if (view === 'QUARTERLY') {
      from = new Date(focusDate.getFullYear(), quarterMonths[0], 1)
      to = new Date(focusDate.getFullYear(), quarterMonths[2] + 1, 0)
    } else if (view === 'YEARLY') {
      from = new Date(focusDate.getFullYear(), 0, 1)
      to = new Date(focusDate.getFullYear(), 11, 31)
    }

    return meetings
      .filter((meeting) => meeting.start >= from && meeting.start <= addDays(to, 1))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [focusDate, meetings, quarterMonths, view, weeklyDays])

  const selectedDayMeetings = useMemo(() => {
    if (!selectedDay) return []
    return meetingsByDay.get(formatDayKey(selectedDay)) ?? []
  }, [meetingsByDay, selectedDay])

  const jumpToToday = () => setFocusDate(today)

  const goPrev = () => {
    if (view === 'DAILY') setFocusDate((current) => addDays(current, -1))
    else if (view === 'WEEKLY') setFocusDate((current) => addDays(current, -7))
    else if (view === 'MONTHLY') setFocusDate((current) => addMonths(current, -1))
    else if (view === 'QUARTERLY') setFocusDate((current) => addMonths(current, -3))
    else setFocusDate((current) => addMonths(current, -12))
  }

  const goNext = () => {
    if (view === 'DAILY') setFocusDate((current) => addDays(current, 1))
    else if (view === 'WEEKLY') setFocusDate((current) => addDays(current, 7))
    else if (view === 'MONTHLY') setFocusDate((current) => addMonths(current, 1))
    else if (view === 'QUARTERLY') setFocusDate((current) => addMonths(current, 3))
    else setFocusDate((current) => addMonths(current, 12))
  }

  const openDayDialog = (day: Date) => {
    setSelectedDay(day)
    setDayDialogOpen(true)
  }

  const goToEventLead = (meeting: Meeting) => {
    router.push(`/crm/sr/leads/${meeting.leadId}`)
  }

  const DailyView = (
    <div className="h-full rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-[84px_1fr] bg-muted/40 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Time</p>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {focusDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
      </div>
      <div className="grid h-[calc(100%-41px)]" style={{ gridTemplateRows: `repeat(${HOURS.length}, minmax(0, 1fr))` }}>
        {HOURS.map((hour) => {
          const hourEvents =
            meetingsByDay
              .get(formatDayKey(focusDate))
              ?.filter((item) => item.start.getHours() === hour) ?? []
          return (
            <div key={`d-${hour}`} className="grid min-h-0 grid-cols-[84px_1fr] border-t border-border">
              <div className="px-3 py-1.5 text-xs text-muted-foreground">{formatHourLabel(hour)}</div>
              <div className="min-h-0 px-2 py-1">
                {hourEvents.length > 0 ? (
                  <div className="space-y-1">
                    {hourEvents.slice(0, 1).map((event) => (
                      <CompactEventCard key={event.id} event={event} dense onClick={() => goToEventLead(event)} />
                    ))}
                    {hourEvents.length > 1 ? (
                      <p className="truncate text-[10px] font-medium text-muted-foreground">+{hourEvents.length - 1} more</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const WeeklyView = (
    <div className="h-full rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-[72px_repeat(7,minmax(120px,1fr))] bg-muted/40">
        <div className="border-r border-border px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Time
        </div>
        {weeklyDays.map((day, index) => (
          <div
            key={formatDayKey(day)}
            className="border-r border-border px-2 py-2 text-center last:border-r-0"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {WEEKDAY_LABELS[index]}
            </p>
            <p className={`text-sm font-semibold ${isSameDay(day, today) ? 'text-primary' : 'text-foreground'}`}>
              {day.getDate()}
            </p>
          </div>
        ))}
      </div>

      <div className="grid h-[calc(100%-49px)]" style={{ gridTemplateRows: `repeat(${HOURS.length}, minmax(0, 1fr))` }}>
        {HOURS.map((hour) => (
          <div key={`w-${hour}`} className="grid min-h-0 grid-cols-[72px_repeat(7,minmax(120px,1fr))] border-t border-border">
            <div className="border-r border-border px-2 py-1 text-[10px] text-muted-foreground">
              {formatHourLabel(hour)}
            </div>
            {weeklyDays.map((day) => {
              const events =
                meetingsByDay
                  .get(formatDayKey(day))
                  ?.filter((item) => item.start.getHours() === hour) ?? []
              return (
                <div
                  key={`${formatDayKey(day)}-${hour}`}
                  className="min-h-0 border-r border-border px-1 py-1 last:border-r-0"
                >
                  <div className="space-y-1">
                    {events.slice(0, 1).map((event) => (
                      <CompactEventCard key={event.id} event={event} dense onClick={() => goToEventLead(event)} />
                    ))}
                    {events.length > 1 ? (
                      <p className="text-[10px] font-medium text-muted-foreground">+{events.length - 1} more</p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )

  const monthRowCount = Math.max(1, Math.ceil(monthDays.length / 7))
  const MonthlyView = (
    <div className="h-full rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-7 bg-muted/40">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="border-r border-border px-2 py-2 text-center text-xs font-semibold text-muted-foreground last:border-r-0">
            {label}
          </div>
        ))}
      </div>

      <div
        className="grid h-[calc(100%-41px)] grid-cols-7"
        style={{ gridTemplateRows: `repeat(${monthRowCount}, minmax(0, 1fr))` }}
      >
        {monthDays.map((day, index) => {
          const inCurrentMonth = day.getMonth() === focusDate.getMonth()
          const events = meetingsByDay.get(formatDayKey(day)) ?? []
          return (
            <div
              key={`${formatDayKey(day)}-${index}`}
              className="min-h-0 border-r border-t border-border px-1.5 py-1.5 last:border-r-0"
            >
              <p
                className={`mb-1 text-xs font-semibold ${
                  isSameDay(day, today)
                    ? 'text-primary'
                    : inCurrentMonth
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                }`}
              >
                {day.getDate()}
              </p>
              <div className="space-y-1">
                {events.slice(0, 1).map((event) => (
                  <CompactEventCard key={event.id} event={event} dense onClick={() => goToEventLead(event)} />
                ))}
                {events.length > 1 ? (
                  <p className="text-[10px] text-muted-foreground">+{events.length - 1} more</p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const QuarterView = (
    <div className="grid h-full grid-cols-1 gap-2 xl:grid-cols-3">
      {quarterMonths.map((monthIndex) => {
        const cells = buildMonthGrid(focusDate.getFullYear(), monthIndex)
        return (
          <Card key={`q-${monthIndex}`} className="flex min-h-0 flex-col overflow-hidden">
            <CardHeader className="pb-1 pt-3">
              <CardTitle className="text-sm">{MONTH_LABELS[monthIndex]}</CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col pt-0">
              <div className="mb-1 grid grid-cols-7 text-[9px] text-muted-foreground">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={`${monthIndex}-${label}`} className="text-center font-semibold">
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid flex-1 grid-cols-7 gap-1">
                {cells.map((day) => {
                  const inMonth = day.getMonth() === monthIndex
                  const count = meetingsByDay.get(formatDayKey(day))?.length ?? 0
                  return (
                    <div
                      key={`${monthIndex}-${formatDayKey(day)}`}
                      onClick={() => openDayDialog(day)}
                      onKeyDown={(event) => event.key === 'Enter' && openDayDialog(day)}
                      role="button"
                      tabIndex={0}
                      className={`rounded border px-1 py-0.5 text-[9px] cursor-pointer transition hover:border-primary/40 ${
                        inMonth ? 'border-border text-foreground' : 'border-transparent text-muted-foreground'
                      }`}
                    >
                      <p>{day.getDate()}</p>
                      {count > 0 ? <p className="text-primary font-semibold">{count}</p> : null}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )

  const YearView = (
    <div className="grid h-full auto-rows-fr grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4">
      {MONTH_LABELS.map((monthLabel, monthIndex) => {
        const cells = buildMonthGrid(focusDate.getFullYear(), monthIndex)
        return (
          <Card key={`y-${monthLabel}`} className="flex min-h-0 flex-col overflow-hidden">
            <CardHeader className="pb-1 pt-2">
              <CardTitle className="text-xs">{monthLabel}</CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col pt-0">
              <div className="grid flex-1 grid-cols-7 gap-0.5 text-[9px]">
                {cells.map((day) => {
                  const inMonth = day.getMonth() === monthIndex
                  const meetingCount = meetingsByDay.get(formatDayKey(day))?.length ?? 0
                  const taskCount =
                    meetingsByDay
                      .get(formatDayKey(day))
                      ?.filter((item) => item.source === 'TASK').length ?? 0
                  return (
                    <div
                      key={`${monthIndex}-${formatDayKey(day)}`}
                      onClick={() => openDayDialog(day)}
                      onKeyDown={(event) => event.key === 'Enter' && openDayDialog(day)}
                      role="button"
                      tabIndex={0}
                      className={`rounded border flex items-center justify-center cursor-pointer transition hover:border-primary/40 ${
                        inMonth ? 'border-border text-foreground' : 'border-transparent text-muted-foreground'
                      } ${meetingCount > 0 ? 'bg-primary/10 text-primary border-primary/20' : ''} ${
                        taskCount > 0 ? 'ring-1 ring-amber-400/70' : ''
                      }`}
                    >
                      {day.getDate()}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <CrmPageHeader
        title={title}
        subtitle={subtitle}
      />

      <main className="mx-auto flex w-full max-w-[1600px] min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-6 sm:py-4">
        <Card className="border-border/80">
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
                <Badge variant="secondary" className="h-8 px-3">
                  {focusDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="w-[190px]">
                  <Select value={view} onValueChange={(value) => setView(value as CalendarView)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Timeline" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                      <SelectItem value="YEARLY">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <label className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
                  <ListFilter className="size-4 text-muted-foreground" />
                  <span>Agenda (Desktop)</span>
                  <Switch checked={showAgenda} onCheckedChange={setShowAgenda} />
                </label>

                {!lockMyLeadsOnly ? (
                  <label className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
                    <span>My Leads Only</span>
                    <Switch checked={myLeadsOnly} onCheckedChange={setMyLeadsOnly} />
                  </label>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className={`mt-3 grid min-h-0 flex-1 gap-3 ${showAgenda ? 'xl:grid-cols-[minmax(0,1fr)_300px]' : 'grid-cols-1'}`}>
          <section className="min-w-0 min-h-0">
            {meetingError ? (
              <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {meetingError}
              </div>
            ) : null}
            {view === 'DAILY' ? DailyView : null}
            {view === 'WEEKLY' ? WeeklyView : null}
            {view === 'MONTHLY' ? MonthlyView : null}
            {view === 'QUARTERLY' ? QuarterView : null}
            {view === 'YEARLY' ? YearView : null}
          </section>

          {showAgenda ? (
            <aside className="hidden min-h-0 xl:block">
              <Card className="flex h-full min-h-0 flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Agenda</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 overflow-hidden">
                  {loadingMeetings ? (
                    <p className="text-sm text-muted-foreground">Loading meetings...</p>
                  ) : visibleMeetings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No meetings in this timeline.</p>
                  ) : (
                    visibleMeetings.slice(0, MAX_AGENDA_ITEMS).map((meeting) => (
                      <div
                        key={meeting.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => goToEventLead(meeting)}
                        onKeyDown={(event) => event.key === 'Enter' && goToEventLead(meeting)}
                        className={`rounded-md border p-3 ${
                          meeting.source === 'TASK'
                            ? 'border-amber-300 bg-amber-50/50 dark:border-amber-800/70 dark:bg-amber-950/25'
                            : 'border-border'
                        } cursor-pointer transition hover:border-primary/40`}
                      >
                        <p className="text-sm font-semibold text-foreground">{meeting.title}</p>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {getEventLabel(meeting)}
                        </p>
                        <p className="text-xs text-muted-foreground">{meeting.leadName}</p>
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3.5" />
                          {meeting.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })},{' '}
                          {formatEventTime(meeting.start)} - {formatEventTime(meeting.end)}
                        </p>
                        <Badge className={`mt-2 border ${getEventClass(meeting)}`}>
                          {meeting.source === 'TASK'
                            ? `TASK DEADLINE${meeting.taskStatus ? ` - ${meeting.taskStatus}` : ''}`
                            : meeting.type.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    ))
                  )}
                  {!loadingMeetings && visibleMeetings.length > MAX_AGENDA_ITEMS ? (
                    <p className="text-xs text-muted-foreground">
                      +{visibleMeetings.length - MAX_AGENDA_ITEMS} more items in this timeline.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </aside>
          ) : null}
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
                  className={`rounded-md border p-3 ${
                    meeting.source === 'TASK'
                      ? 'border-amber-300 bg-amber-50/50 dark:border-amber-800/70 dark:bg-amber-950/25'
                      : 'border-border'
                  } cursor-pointer transition hover:border-primary/40`}
                >
                  <p className="text-sm font-semibold text-foreground">{meeting.title}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {getEventLabel(meeting)}
                  </p>
                  <p className="text-xs text-muted-foreground">{meeting.leadName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatEventTime(meeting.start)} - {formatEventTime(meeting.end)}
                  </p>
                  <Badge className={`mt-2 border ${getEventClass(meeting)}`}>
                    {meeting.source === 'TASK'
                      ? `TASK DEADLINE${meeting.taskStatus ? ` - ${meeting.taskStatus}` : ''}`
                      : meeting.type.replace(/_/g, ' ')}
                  </Badge>
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
