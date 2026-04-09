'use client'

import { useEffect, useMemo, useState } from 'react'
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
  type: 'FIRST_MEETING' | 'BUDGET_MEETING' | 'REVIEW_CHECKPOINT'
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7)
const WEEKDAY_LABELS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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
  if (type === 'FIRST_MEETING') return 'bg-blue-100 text-blue-800 border-blue-200'
  if (type === 'BUDGET_MEETING') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  return 'bg-violet-100 text-violet-800 border-violet-200'
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

function toMeeting(item: MeetingsApiItem): Meeting {
  const start = new Date(item.startsAt)
  const end = item.endsAt ? new Date(item.endsAt) : new Date(start.getTime() + 60 * 60 * 1000)
  return {
    id: item.id,
    leadId: item.lead.id,
    title: item.title,
    leadName: item.lead.name,
    type: item.type,
    start,
    end,
  }
}

export default function SeniorCrmMeetingsPage() {
  const today = useMemo(() => startOfDay(new Date()), [])
  const [focusDate, setFocusDate] = useState(today)
  const [view, setView] = useState<CalendarView>('DAILY')
  const [showAgenda, setShowAgenda] = useState(true)
  const [myLeadsOnly, setMyLeadsOnly] = useState(true)
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
        if (!cancelled) {
          setMeetings(payload.data.map(toMeeting))
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

  const DailyView = (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-[84px_1fr] bg-muted/40 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Time</p>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {focusDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
      </div>
      {HOURS.map((hour) => {
        const hourEvents =
          meetingsByDay
            .get(formatDayKey(focusDate))
            ?.filter((item) => item.start.getHours() === hour) ?? []
        return (
          <div key={`d-${hour}`} className="grid grid-cols-[84px_1fr] border-t border-border">
            <div className="px-3 py-3 text-xs text-muted-foreground">{formatHourLabel(hour)}</div>
            <div className="min-h-[64px] px-3 py-2">
              {hourEvents.length === 0 ? null : (
                <div className="space-y-2">
                  {hourEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`rounded-md border px-2 py-1.5 text-xs ${getTypeClass(event.type)}`}
                    >
                      <p className="font-semibold">{event.title}</p>
                      <p>{event.leadName}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  const WeeklyView = (
    <div className="rounded-lg border border-border overflow-hidden">
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

      {HOURS.map((hour) => (
        <div key={`w-${hour}`} className="grid grid-cols-[72px_repeat(7,minmax(120px,1fr))] border-t border-border">
          <div className="border-r border-border px-2 py-2 text-[11px] text-muted-foreground">
            {formatHourLabel(hour)}
          </div>
          {weeklyDays.map((day) => {
            const events =
              meetingsByDay
                .get(formatDayKey(day))
                ?.filter((item) => item.start.getHours() === hour) ?? []
            return (
              <div key={`${formatDayKey(day)}-${hour}`} className="border-r border-border px-1.5 py-1.5 last:border-r-0 min-h-[56px]">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className={`mb-1 rounded border px-1.5 py-1 text-[10px] leading-tight ${getTypeClass(
                      event.type,
                    )}`}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )

  const MonthlyView = (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-7 bg-muted/40">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="border-r border-border px-2 py-2 text-center text-xs font-semibold text-muted-foreground last:border-r-0">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {monthDays.map((day, index) => {
          const inCurrentMonth = day.getMonth() === focusDate.getMonth()
          const events = meetingsByDay.get(formatDayKey(day)) ?? []
          return (
            <div
              key={`${formatDayKey(day)}-${index}`}
              className="min-h-[130px] border-r border-t border-border px-2 py-2 last:border-r-0"
            >
              <p
                className={`mb-2 text-xs font-semibold ${
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
                {events.slice(0, 3).map((event) => (
                  <div key={event.id} className={`truncate rounded border px-1.5 py-1 text-[10px] ${getTypeClass(event.type)}`}>
                    {event.title}
                  </div>
                ))}
                {events.length > 3 ? (
                  <p className="text-[10px] text-muted-foreground">+{events.length - 3} more</p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const QuarterView = (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {quarterMonths.map((monthIndex) => {
        const cells = buildMonthGrid(focusDate.getFullYear(), monthIndex)
        return (
          <Card key={`q-${monthIndex}`} className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{MONTH_LABELS[monthIndex]}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-7 text-[10px] text-muted-foreground mb-1">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={`${monthIndex}-${label}`} className="text-center font-semibold">
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
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
                      className={`rounded border px-1 py-1 text-[10px] cursor-pointer transition hover:border-primary/40 ${
                        inMonth ? 'border-border text-foreground' : 'border-transparent text-muted-foreground'
                      }`}
                    >
                      <p>{day.getDate()}</p>
                      {count > 0 ? <p className="text-primary font-semibold">{count} mtg</p> : null}
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {MONTH_LABELS.map((monthLabel, monthIndex) => {
        const cells = buildMonthGrid(focusDate.getFullYear(), monthIndex)
        return (
          <Card key={`y-${monthLabel}`} className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{monthLabel}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-7 gap-1 text-[10px]">
                {cells.map((day) => {
                  const inMonth = day.getMonth() === monthIndex
                  const meetingCount = meetingsByDay.get(formatDayKey(day))?.length ?? 0
                  return (
                    <div
                      key={`${monthIndex}-${formatDayKey(day)}`}
                      onClick={() => openDayDialog(day)}
                      onKeyDown={(event) => event.key === 'Enter' && openDayDialog(day)}
                      role="button"
                      tabIndex={0}
                      className={`h-7 rounded border flex items-center justify-center cursor-pointer transition hover:border-primary/40 ${
                        inMonth ? 'border-border text-foreground' : 'border-transparent text-muted-foreground'
                      } ${meetingCount > 0 ? 'bg-primary/10 text-primary border-primary/20' : ''}`}
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
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="Meetings"
        subtitle="Google-calendar style timeline view for first meetings and budget meetings."
      />

      <main className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 sm:py-6">
        <Card className="mb-4 border-border/80">
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
                  <span>Agenda</span>
                  <Switch checked={showAgenda} onCheckedChange={setShowAgenda} />
                </label>

                <label className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
                  <span>My Leads Only</span>
                  <Switch checked={myLeadsOnly} onCheckedChange={setMyLeadsOnly} />
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className={`grid gap-4 ${showAgenda ? 'xl:grid-cols-[minmax(0,1fr)_330px]' : 'grid-cols-1'}`}>
          <section className="min-w-0">
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
            <aside>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Agenda</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingMeetings ? (
                    <p className="text-sm text-muted-foreground">Loading meetings...</p>
                  ) : visibleMeetings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No meetings in this timeline.</p>
                  ) : (
                    visibleMeetings.map((meeting) => (
                      <div key={meeting.id} className="rounded-md border border-border p-3">
                        <p className="text-sm font-semibold text-foreground">{meeting.title}</p>
                        <p className="text-xs text-muted-foreground">{meeting.leadName}</p>
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3.5" />
                          {meeting.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })},{' '}
                          {meeting.start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <Badge className={`mt-2 border ${getTypeClass(meeting.type)}`}>
                          {meeting.type.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    ))
                  )}
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
                <div key={meeting.id} className="rounded-md border border-border p-3">
                  <p className="text-sm font-semibold text-foreground">{meeting.title}</p>
                  <p className="text-xs text-muted-foreground">{meeting.leadName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {meeting.start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} -{' '}
                    {meeting.end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <Badge className={`mt-2 border ${getTypeClass(meeting.type)}`}>
                    {meeting.type.replace(/_/g, ' ')}
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
