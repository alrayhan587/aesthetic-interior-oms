'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, MapPin, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from '@/components/ui/sonner'

type VisitRecord = {
  id: string
  leadId: string
  scheduledAt: string
  status: string
  location: string
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

type VisitApiResponse = {
  success: boolean
  data?: VisitRecord[]
  error?: string
}

type VisitTeamMember = {
  id: string
  fullName: string
  email: string
}

const calendarWeekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatStatus(status: string) {
  return status === 'SCHEDULED' ? 'PENDING' : status
}

function statusBadgeClass(status: string) {
  if (status === 'COMPLETED') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
  if (status === 'CANCELLED') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
  if (status === 'RESCHEDULED') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
}

export default function VisitScheduleQueuePage() {
  const [visits, setVisits] = useState<VisitRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string>(() => formatDateKey(new Date()))
  const [reassignOpen, setReassignOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [activeVisit, setActiveVisit] = useState<VisitRecord | null>(null)
  const [memberOptions, setMemberOptions] = useState<VisitTeamMember[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(false)
  const queueListRef = useRef<HTMLDivElement | null>(null)

  const loadVisits = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/visit-schedule?scope=all', { cache: 'no-store' })
      const payload = (await response.json()) as VisitApiResponse
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to load visit schedule queue')
      }
      setVisits(payload.data ?? [])
    } catch (err) {
      setVisits([])
      setError(err instanceof Error ? err.message : 'Failed to load visit schedule queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadVisits()
  }, [])

  const visitsByDate = useMemo(() => {
    const grouped: Record<string, VisitRecord[]> = {}
    for (const visit of visits) {
      const key = formatDateKey(new Date(visit.scheduledAt))
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(visit)
    }
    return grouped
  }, [visits])

  const selectedDayVisits = useMemo(() => {
    return (visitsByDate[selectedDate] ?? []).sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    )
  }, [selectedDate, visitsByDate])

  const monthTitle = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const calendarDays: Array<number | null> = [
    ...Array.from({ length: firstDayOfMonth }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  const goPrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  const goNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))

  const dayKey = (day: number) => formatDateKey(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))

  const handleSelectDate = (dateKey: string) => {
    setSelectedDate(dateKey)
    requestAnimationFrame(() => {
      queueListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const openReassign = async (visit: VisitRecord) => {
    setActiveVisit(visit)
    setSelectedMemberId(visit.assignedTo?.id ?? '')
    setReassignOpen(true)
    if (memberOptions.length > 0) return

    setLoadingMembers(true)
    try {
      const response = await fetch('/api/department/available/VISIT_TEAM', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Failed to load visit members')
      const users = Array.isArray(payload.users) ? payload.users : []
      setMemberOptions(
        users.map((user: VisitTeamMember) => ({ id: user.id, fullName: user.fullName, email: user.email })),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load visit members')
    } finally {
      setLoadingMembers(false)
    }
  }

  const submitReassign = async () => {
    if (!activeVisit || !selectedMemberId) return
    setSaving(true)
    try {
      const response = await fetch(`/api/visit-schedule/${activeVisit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitTeamUserId: selectedMemberId,
          reason: 'Reassigned by visit team leader queue',
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Failed to reassign visit')
      toast.success('Visit reassigned.')
      setReassignOpen(false)
      setActiveVisit(null)
      await loadVisits()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reassign visit')
    } finally {
      setSaving(false)
    }
  }

  const openCancel = (visit: VisitRecord) => {
    setActiveVisit(visit)
    setCancelReason('')
    setCancelOpen(true)
  }

  const submitCancel = async () => {
    if (!activeVisit) return
    if (!cancelReason.trim()) {
      toast.error('Cancel reason is required.')
      return
    }
    setSaving(true)
    try {
      const response = await fetch(`/api/visit-schedule/${activeVisit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'CANCELLED',
          reason: cancelReason.trim(),
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Failed to cancel visit')
      toast.success('Visit cancelled.')
      setCancelOpen(false)
      setActiveVisit(null)
      await loadVisits()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel visit')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="Visit Schedule Queue"
        subtitle="Leader view for all visit schedules with quick assignment controls."
      />

      <main className="mx-auto max-w-[1440px] space-y-4 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-6">
        {loading ? (
          <div className="flex items-center justify-center rounded-lg border border-border bg-card py-14">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card className="xl:col-span-7">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base sm:text-lg">{monthTitle}</CardTitle>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="icon" onClick={goPrevMonth}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" onClick={goNextMonth}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-7 gap-1">
                  {calendarWeekLabels.map((label) => (
                    <div key={label} className="py-1 text-center text-[11px] font-semibold text-muted-foreground sm:text-xs">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, index) => {
                    if (!day) {
                      return <div key={`empty-${index}`} className="h-14 rounded-md border border-transparent sm:h-16" />
                    }
                    const key = dayKey(day)
                    const dayVisits = visitsByDate[key] ?? []
                    const isSelected = key === selectedDate
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSelectDate(key)}
                        className={`h-14 rounded-md border px-1 py-1 text-center transition sm:h-16 ${
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : dayVisits.length > 0
                              ? 'border-blue-300 bg-blue-50/60 hover:border-blue-400 dark:bg-blue-900/15'
                              : 'border-border hover:border-primary/40'
                        }`}
                      >
                        <p className="text-xs font-semibold">{day}</p>
                        {dayVisits.length > 0 ? (
                          <p className="mt-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-700 px-1 text-[10px] font-bold text-white">
                            {dayVisits.length}
                          </p>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-5" ref={queueListRef}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">
                  Queue for {new Date(selectedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:max-h-[70vh] sm:overflow-y-auto">
                {selectedDayVisits.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No visits scheduled for this day.</p>
                ) : (
                  selectedDayVisits.map((visit) => {
                    const visitTime = new Date(visit.scheduledAt).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                    return (
                      <div key={visit.id} className="rounded-lg border border-border bg-card p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="truncate font-semibold text-foreground">{visit.lead?.name || 'Unknown Client'}</p>
                          <Badge className={statusBadgeClass(visit.status)}>{formatStatus(visit.status)}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="truncate">{visit.location || visit.lead?.location || 'No location'}</span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{visitTime}</span>
                          </p>
                          <p>
                            Visit Team Lead:{' '}
                            <span className="font-medium text-foreground">
                              {visit.assignedTo?.fullName || 'Unassigned'}
                            </span>
                          </p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/visit-team/leads/${visit.leadId}`}>Detail</Link>
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => void openReassign(visit)}>
                            Reassign
                          </Button>
                          <Button type="button" size="sm" variant="destructive" onClick={() => openCancel(visit)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Visit Lead</DialogTitle>
            <DialogDescription>Choose the visit team member who will lead this visit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId} disabled={loadingMembers || saving}>
              <SelectTrigger>
                <SelectValue placeholder={loadingMembers ? 'Loading members...' : 'Select visit lead'} />
              </SelectTrigger>
              <SelectContent>
                {memberOptions.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.fullName} ({member.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReassignOpen(false)} disabled={saving}>
              Close
            </Button>
            <Button type="button" onClick={() => void submitReassign()} disabled={saving || !selectedMemberId}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Reassign'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Visit</DialogTitle>
            <DialogDescription>Provide a reason before cancelling this visit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Write cancellation reason"
              rows={4}
              disabled={saving}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)} disabled={saving}>
              Close
            </Button>
            <Button type="button" variant="destructive" onClick={() => void submitCancel()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Confirm Cancel'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
