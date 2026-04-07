'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Clock, MapPin, AlertCircle, Loader2, CalendarDays, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from '@/components/ui/sonner'
import { fetchMeCached } from '@/lib/client-me'
import {
  budgetRangeOptions,
  clientMoodOptions,
  clientPersonalityOptions,
  clientPotentialityOptions,
  projectTypeOptions,
  stylePreferenceOptions,
  urgencyOptions,
} from '@/lib/visit-result-options'

type VisitRecord = {
  id: string
  scheduledAt: string
  location: string
  notes: string | null
  status: string
  projectSqft: number | null
  projectStatus: string | null
  lead: {
    id: string
    name: string
    phone: string
    location: string | null
  }
  assignedTo?: {
    id: string
    fullName: string
    email: string
    phone: string
  } | null
  supportAssignments?: Array<{
    id: string
    supportUserId: string
    supportUser: {
      id: string
      fullName: string
      email: string
    }
    result?: {
      id: string
      completedAt: string
    } | null
  }>
}

type ApiResponse = {
  success: boolean
  data?: VisitRecord[]
  error?: string
}

type SupportMemberOption = {
  id: string
  fullName: string
  email: string
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getStatusBadgeColor(status: string) {
  const statusLower = status.toLowerCase()
  if (statusLower.includes('confirmed')) return 'bg-green-500/20 text-green-700 dark:text-green-400'
  if (statusLower.includes('pending')) return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
  if (statusLower.includes('completed')) return 'bg-blue-500/20 text-blue-700 dark:text-blue-400'
  return 'bg-muted text-foreground'
}

function formatStatusLabel(status: string) {
  if (status === 'SCHEDULED') return 'PENDING'
  return status.replace(/_/g, ' ')
}
const selectUnsetValue = '__UNSET__'

export default function VisitTodayPage() {
  const [visits, setVisits] = useState<VisitRecord[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requestOpen, setRequestOpen] = useState(false)
  const [selectedVisit, setSelectedVisit] = useState<VisitRecord | null>(null)
  const [requestType, setRequestType] = useState<'RESCHEDULE' | 'CANCEL'>('RESCHEDULE')
  const [requestReason, setRequestReason] = useState('')
  const [requestScheduleAt, setRequestScheduleAt] = useState('')
  const [requestError, setRequestError] = useState<string | null>(null)
  const [sendingRequest, setSendingRequest] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [completeVisit, setCompleteVisit] = useState<VisitRecord | null>(null)
  const [completeRole, setCompleteRole] = useState<'LEAD' | 'SUPPORT'>('LEAD')
  const [completeSummary, setCompleteSummary] = useState('')
  const [completeClientMood, setCompleteClientMood] = useState('')
  const [completeProjectStatus, setCompleteProjectStatus] = useState('')
  const [completeNote, setCompleteNote] = useState('')
  const [completeClientPotentiality, setCompleteClientPotentiality] = useState('')
  const [completeProjectType, setCompleteProjectType] = useState('')
  const [completeClientPersonality, setCompleteClientPersonality] = useState('')
  const [completeBudgetRange, setCompleteBudgetRange] = useState('')
  const [completeTimelineUrgency, setCompleteTimelineUrgency] = useState('')
  const [completeStylePreference, setCompleteStylePreference] = useState('')
  const [supportClientName, setSupportClientName] = useState('')
  const [supportProjectArea, setSupportProjectArea] = useState('')
  const [supportProjectStatus, setSupportProjectStatus] = useState('')
  const [supportExtraConcern, setSupportExtraConcern] = useState('')
  const [completeFiles, setCompleteFiles] = useState<File[]>([])
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [submittingComplete, setSubmittingComplete] = useState(false)
  const [supportDialogOpen, setSupportDialogOpen] = useState(false)
  const [supportDialogVisitId, setSupportDialogVisitId] = useState('')
  const [supportDialogSelection, setSupportDialogSelection] = useState('')
  const [supportDialogMembers, setSupportDialogMembers] = useState<SupportMemberOption[]>([])
  const [supportDialogError, setSupportDialogError] = useState<string | null>(null)
  const [supportDialogLoading, setSupportDialogLoading] = useState(false)
  const [supportDialogSaving, setSupportDialogSaving] = useState(false)

  useEffect(() => {
    fetchMeCached()
      .then((data) => {
        if (data?.id) setCurrentUserId(String(data.id))
      })
      .catch(() => {
        setCurrentUserId(null)
      })
  }, [])

  useEffect(() => {
    const loadVisits = async () => {
      try {
        const response = await fetch('/api/visit-schedule')
        const payload = (await response.json()) as ApiResponse

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Failed to load visits')
        }

        setVisits(payload.data ?? [])
        setError(null)
      } catch (err) {
        setVisits([])
        setError(err instanceof Error ? err.message : 'Failed to load visits')
      } finally {
        setLoading(false)
      }
    }

    loadVisits()
  }, [])

  const todayKey = formatDateKey(new Date())
  const getVisitRole = (visit: VisitRecord): 'LEAD' | 'SUPPORT' | 'NONE' => {
    if (!currentUserId) return 'NONE'
    if (visit.assignedTo?.id === currentUserId) return 'LEAD'
    const isSupport = (visit.supportAssignments ?? []).some((item) => item.supportUserId === currentUserId)
    return isSupport ? 'SUPPORT' : 'NONE'
  }
  const canManageSupportForVisit = (visit: VisitRecord) => {
    if (!currentUserId) return false
    return visit.assignedTo?.id === currentUserId
  }
  const canRequestVisitUpdate = (visit: VisitRecord) => {
    if (!currentUserId) return false
    if (visit.status === 'COMPLETED' || visit.status === 'CANCELLED') return false
    return getVisitRole(visit) === 'LEAD'
  }

  const todayVisits = useMemo(() => {
    return visits
      .filter((visit) => {
        const parsed = new Date(visit.scheduledAt)
        return !Number.isNaN(parsed.getTime()) && formatDateKey(parsed) === todayKey
      })
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      )
  }, [todayKey, visits])

  const completedCount = todayVisits.filter((visit) => visit.status === 'COMPLETED').length
  const cancelledCount = todayVisits.filter((visit) => visit.status === 'CANCELLED').length
  const pendingCount = Math.max(todayVisits.length - completedCount - cancelledCount, 0)

  const visitQueueContent = (
    <Card className="xl:col-span-8 xl:flex xl:flex-col xl:overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Visit Queue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 xl:flex-1 xl:overflow-y-auto">
        {todayVisits.map((visit, index) => {
          const visitDate = new Date(visit.scheduledAt)
          return (
            <motion.div
              key={visit.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: index * 0.04 }}
              className={`rounded-xl border p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md ${
                getVisitRole(visit) === 'SUPPORT'
                  ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-900/10'
                  : 'border-border bg-card'
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-card-foreground">
                      {visit.lead?.name || 'Unknown Lead'}
                    </h3>
                    <Badge className={getStatusBadgeColor(visit.status)}>{formatStatusLabel(visit.status)}</Badge>
                    {getVisitRole(visit) !== 'NONE' ? (
                      <Badge
                        variant="outline"
                        className={
                          getVisitRole(visit) === 'LEAD'
                            ? 'border-blue-300 text-blue-700'
                            : 'border-emerald-300 text-emerald-700'
                        }
                      >
                        {getVisitRole(visit) === 'LEAD' ? 'Leading' : 'Supporting'}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {visitDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {visit.location}
                    </span>
                  </div>
                  {(visit.projectSqft || visit.projectStatus || visit.notes) && (
                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      {visit.projectSqft ? (
                        <p>Sqft: <span className="font-medium text-foreground">{visit.projectSqft.toLocaleString()}</span></p>
                      ) : null}
                      {visit.projectStatus ? (
                        <p>Status: <span className="font-medium text-foreground">{visit.projectStatus.replace(/_/g, ' ')}</span></p>
                      ) : null}
                      {visit.notes ? <p className="italic">{visit.notes}</p> : null}
                    </div>
                  )}
                  <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                    <p className="font-semibold text-foreground">Support Members</p>
                    {(visit.supportAssignments ?? []).length > 0 ? (
                      <div className="mt-1 space-y-1">
                        {(visit.supportAssignments ?? []).map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">{item.supportUser.fullName}</span>
                            {canManageSupportForVisit(visit) ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => void handleRemoveSupportMember(visit.id, item.supportUserId)}
                              >
                                Remove
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-amber-800">
                        <p className="font-semibold">Warning: no support members assigned.</p>
                      </div>
                    )}
                    {canManageSupportForVisit(visit) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7 px-2 text-[11px]"
                        onClick={() => void openSupportDialog(visit)}
                      >
                        Manage Support Members
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/visit-team/leads/${visit.lead.id}`}>Open Lead</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openRequestDialog(visit, 'RESCHEDULE')}
                    disabled={!canRequestVisitUpdate(visit)}
                    title={!canRequestVisitUpdate(visit) ? 'Only assigned lead can reschedule or cancel this visit.' : undefined}
                  >
                    Reschedule
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openRequestDialog(visit, 'CANCEL')}
                    className="text-destructive hover:text-destructive"
                    disabled={!canRequestVisitUpdate(visit)}
                    title={!canRequestVisitUpdate(visit) ? 'Only assigned lead can reschedule or cancel this visit.' : undefined}
                  >
                    Cancel
                  </Button>
                  {visit.status !== 'COMPLETED' && getVisitRole(visit) !== 'NONE' ? (
                    <Button size="sm" onClick={() => openCompleteDialog(visit)}>
                      {getVisitRole(visit) === 'SUPPORT' ? 'Submit Support Data' : 'Complete Visit'}
                    </Button>
                  ) : null}
                </div>
              </div>
            </motion.div>
          )
        })}
      </CardContent>
    </Card>
  )

  const quickTimelineContent = (
    <Card className="xl:flex-1 xl:overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Timeline</CardTitle>
      </CardHeader>
      <CardContent className="xl:overflow-y-auto">
        <div className="relative pl-4">
          <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
          <div className="space-y-3">
            {todayVisits.map((visit) => {
              const visitDate = new Date(visit.scheduledAt)
              return (
                <div key={`${visit.id}-timeline`} className="relative rounded-lg border border-border bg-card p-3">
                  <span className="absolute -left-[13px] top-4 size-3 rounded-full border-2 border-primary bg-background" />
                  <p className="text-xs font-semibold text-foreground">
                    {visitDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-sm font-medium text-card-foreground">{visit.lead?.name || 'Unknown Lead'}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{visit.location}</p>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const todaySummaryContent = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Today Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>Total planned visits: <span className="font-semibold text-foreground">{todayVisits.length}</span></p>
        <p>Pending actions: <span className="font-semibold text-foreground">{pendingCount}</span></p>
        <p>Finished so far: <span className="font-semibold text-foreground">{completedCount}</span></p>
      </CardContent>
    </Card>
  )

  const openRequestDialog = (visit: VisitRecord, type: 'RESCHEDULE' | 'CANCEL') => {
    if (!canRequestVisitUpdate(visit)) return
    setSelectedVisit(visit)
    setRequestType(type)
    setRequestReason('')
    setRequestScheduleAt('')
    setRequestError(null)
    setRequestOpen(true)
  }

  const openCompleteDialog = (visit: VisitRecord) => {
    const role = getVisitRole(visit)
    if (role === 'NONE') return
    setCompleteVisit(visit)
    setCompleteRole(role)
    setCompleteSummary('')
    setCompleteClientMood('')
    setCompleteProjectStatus('')
    setCompleteNote('')
    setCompleteClientPotentiality('')
    setCompleteProjectType('')
    setCompleteClientPersonality('')
    setCompleteBudgetRange('')
    setCompleteTimelineUrgency('')
    setCompleteStylePreference('')
    setSupportClientName('')
    setSupportProjectArea('')
    setSupportProjectStatus('')
    setSupportExtraConcern('')
    setCompleteFiles([])
    setCompleteError(null)
    setCompleteOpen(true)
  }

  const handleSendRequest = async () => {
    if (!selectedVisit) return
    if (!canRequestVisitUpdate(selectedVisit)) {
      setRequestError('Only assigned lead can reschedule or cancel this visit.')
      return
    }
    if (!requestReason.trim()) {
      setRequestError('Please add a reason.')
      return
    }
    if (requestType === 'RESCHEDULE' && !requestScheduleAt) {
      setRequestError('Please select the requested date/time.')
      return
    }

    setSendingRequest(true)
    setRequestError(null)
    try {
      const response = await fetch(`/api/visit-schedule/${selectedVisit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: requestType === 'RESCHEDULE' ? 'RESCHEDULED' : 'CANCELLED',
          reason: requestReason.trim() || undefined,
          scheduledAt: requestType === 'RESCHEDULE' ? new Date(requestScheduleAt).toISOString() : undefined,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to send update request')
      }
      setRequestOpen(false)
      setSelectedVisit(null)
      setRequestReason('')
      setRequestScheduleAt('')
      toast.success(
        requestType === 'RESCHEDULE'
          ? 'Visit rescheduled. Lead stage updated automatically.'
          : 'Visit cancelled. Lead stage updated automatically.',
      )
      setLoading(true)
      const refreshResponse = await fetch('/api/visit-schedule')
      const refreshPayload = (await refreshResponse.json()) as ApiResponse
      if (!refreshResponse.ok || !refreshPayload.success) {
        throw new Error(refreshPayload.error || 'Failed to refresh visits')
      }
      setVisits(refreshPayload.data ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update visit'
      setRequestError(message)
      toast.error(message)
    } finally {
      setSendingRequest(false)
      setLoading(false)
    }
  }

  const handleCompleteVisit = async () => {
    if (!completeVisit) return
    const pendingSupportCount =
      completeRole === 'LEAD'
        ? (completeVisit.supportAssignments ?? []).filter((item) => !item.result).length
        : 0
    if (pendingSupportCount > 0) {
      setCompleteError(
        'Visit cannot be completed yet. All support members must submit support data first.',
      )
      return
    }
    if (completeRole === 'LEAD' && !completeSummary.trim()) {
      setCompleteError('Summary is required.')
      return
    }
    if (completeRole === 'SUPPORT') {
      if (!supportClientName.trim() || !supportProjectArea.trim() || !supportProjectStatus.trim()) {
        setCompleteError('Client Name, Project Area, and Project Status are required for support.')
        return
      }
    }

    setSubmittingComplete(true)
    setCompleteError(null)
    try {
      const formData = new FormData()
      formData.append('resultType', completeRole)
      if (completeRole === 'LEAD') {
        formData.append('summary', completeSummary.trim())
        if (completeClientMood.trim()) formData.append('clientMood', completeClientMood.trim())
        if (completeProjectStatus) formData.append('projectStatus', completeProjectStatus)
        if (completeNote.trim()) formData.append('note', completeNote.trim())
        if (completeClientPotentiality) formData.append('clientPotentiality', completeClientPotentiality)
        if (completeProjectType) formData.append('projectType', completeProjectType)
        if (completeClientPersonality) formData.append('clientPersonality', completeClientPersonality)
        if (completeBudgetRange.trim()) formData.append('budgetRange', completeBudgetRange.trim())
        if (completeTimelineUrgency) formData.append('timelineUrgency', completeTimelineUrgency)
        if (completeStylePreference) formData.append('stylePreference', completeStylePreference)
      } else {
        formData.append('supportClientName', supportClientName.trim())
        formData.append('supportProjectArea', supportProjectArea.trim())
        formData.append('supportProjectStatus', supportProjectStatus.trim())
        if (supportExtraConcern.trim()) formData.append('supportExtraConcern', supportExtraConcern.trim())
      }
      completeFiles.forEach((file) => {
        formData.append('files', file)
      })

      const response = await fetch(`/api/visit-schedule/${completeVisit.id}/result`, {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to complete visit')
      }

      setCompleteOpen(false)
      setCompleteVisit(null)
      setCompleteFiles([])
      toast.success(
        completeRole === 'SUPPORT'
          ? 'Support data submitted.'
          : 'Visit completed. Lead stage updated automatically.',
      )
      setLoading(true)
      const refreshResponse = await fetch('/api/visit-schedule')
      const refreshPayload = (await refreshResponse.json()) as ApiResponse
      if (!refreshResponse.ok || !refreshPayload.success) {
        throw new Error(refreshPayload.error || 'Failed to refresh visits')
      }
      setVisits(refreshPayload.data ?? [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to complete visit'
      setCompleteError(message)
      toast.error(message)
    } finally {
      setSubmittingComplete(false)
      setLoading(false)
    }
  }

  const openSupportDialog = async (visit: VisitRecord) => {
    setSupportDialogVisitId(visit.id)
    setSupportDialogSelection('')
    setSupportDialogError(null)
    setSupportDialogOpen(true)
    setSupportDialogLoading(true)
    try {
      const response = await fetch(`/api/visit-schedule/${visit.id}/supports`, {
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to load support members')
      }
      const members = Array.isArray(payload?.data?.availableMembers) ? payload.data.availableMembers : []
      setSupportDialogMembers(members)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load support members'
      setSupportDialogError(message)
      setSupportDialogMembers([])
    } finally {
      setSupportDialogLoading(false)
    }
  }

  const handleAddSupportMember = async () => {
    if (!supportDialogVisitId || !supportDialogSelection) {
      setSupportDialogError('Please select a support member.')
      return
    }
    setSupportDialogSaving(true)
    setSupportDialogError(null)
    try {
      const response = await fetch(`/api/visit-schedule/${supportDialogVisitId}/supports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supportUserId: supportDialogSelection }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to add support member')
      }

      const member = supportDialogMembers.find((item) => item.id === supportDialogSelection) ?? null
      setVisits((prev) =>
        prev.map((visit) => {
          if (visit.id !== supportDialogVisitId || !member) return visit
          const existing = visit.supportAssignments ?? []
          if (existing.some((item) => item.supportUserId === member.id)) return visit
          return {
            ...visit,
            supportAssignments: [
              ...existing,
              {
                id: payload?.data?.id ?? `temp-${member.id}`,
                supportUserId: member.id,
                supportUser: {
                  id: member.id,
                  fullName: member.fullName,
                  email: member.email,
                },
                result: null,
              },
            ],
          }
        }),
      )

      toast.success('Support member added.')
      setSupportDialogOpen(false)
      setSupportDialogVisitId('')
      setSupportDialogSelection('')
      setSupportDialogMembers([])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add support member'
      setSupportDialogError(message)
      toast.error(message)
    } finally {
      setSupportDialogSaving(false)
    }
  }

  const handleRemoveSupportMember = async (visitId: string, supportUserId: string) => {
    try {
      const response = await fetch(
        `/api/visit-schedule/${visitId}/supports?supportUserId=${encodeURIComponent(supportUserId)}`,
        {
          method: 'DELETE',
        },
      )
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to remove support member')
      }

      setVisits((prev) =>
        prev.map((visit) => {
          if (visit.id !== visitId) return visit
          return {
            ...visit,
            supportAssignments: (visit.supportAssignments ?? []).filter(
              (item) => item.supportUserId !== supportUserId,
            ),
          }
        }),
      )
      toast.success('Support member removed.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove support member'
      toast.error(message)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-6 rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Today&apos;s Visits</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
            <Badge variant="secondary" className="w-fit gap-1.5 px-3 py-1 text-xs font-semibold">
              <CalendarDays className="size-3.5" />
              {todayVisits.length} {todayVisits.length === 1 ? 'visit' : 'visits'} scheduled
            </Badge>
          </div>
        </motion.div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-xl font-semibold text-card-foreground">{pendingCount}</p>
              </div>
              <Clock className="size-4 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-xl font-semibold text-card-foreground">{completedCount}</p>
              </div>
              <CheckCircle2 className="size-4 text-chart-2" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">Cancelled</p>
                <p className="text-xl font-semibold text-card-foreground">{cancelledCount}</p>
              </div>
              <XCircle className="size-4 text-destructive" />
            </CardContent>
          </Card>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Loading your visits...</p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-destructive">Error loading visits</h3>
                <p className="mt-1 text-sm text-destructive/80">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && todayVisits.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-muted bg-muted/50 py-16 text-center">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium text-foreground">No visits today</h3>
            <p className="mt-1 text-sm text-muted-foreground">You have a free day ahead!</p>
          </div>
        )}

        {!loading && !error && todayVisits.length > 0 ? (
          <>
            <div className="xl:hidden">
              <Tabs defaultValue="timeline" className="w-full">
                <TabsList className="w-full justify-start overflow-x-auto">
                  <TabsTrigger value="timeline">Quick Timeline</TabsTrigger>
                  <TabsTrigger value="queue">Visit Queue</TabsTrigger>
                  <TabsTrigger value="summary">Today Summary</TabsTrigger>
                </TabsList>
                <TabsContent value="timeline" className="mt-4">
                  {quickTimelineContent}
                </TabsContent>
                <TabsContent value="queue" className="mt-4">
                  {visitQueueContent}
                </TabsContent>
                <TabsContent value="summary" className="mt-4">
                  {todaySummaryContent}
                </TabsContent>
              </Tabs>
            </div>

            <div className="hidden xl:grid grid-cols-12 gap-6 xl:h-[calc(100vh-19rem)]">
              {visitQueueContent}
              <div className="space-y-6 xl:col-span-4 xl:flex xl:flex-col xl:overflow-hidden">
                {quickTimelineContent}
                {todaySummaryContent}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {requestType === 'RESCHEDULE' ? 'Reschedule Visit' : 'Cancel Visit'}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {selectedVisit?.lead?.name ? `Update for ${selectedVisit.lead.name}` : 'Update visit'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {requestType === 'RESCHEDULE' && (
              <div className="space-y-2">
                <Label htmlFor="reschedule-date" className="text-sm font-medium">
                  New Date & Time
                </Label>
                <Input
                  id="reschedule-date"
                  type="datetime-local"
                  value={requestScheduleAt}
                  onChange={(event) => setRequestScheduleAt(event.target.value)}
                  className="text-sm"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-medium">
                Reason
              </Label>
              <Textarea
                id="reason"
                value={requestReason}
                onChange={(event) => setRequestReason(event.target.value)}
                rows={4}
                placeholder="Please explain why this visit needs to be updated..."
                className="text-sm resize-none"
              />
            </div>

            {requestError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {requestError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRequestOpen(false)}
              className="text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendRequest}
              disabled={sendingRequest}
              className="text-sm gap-2"
            >
              {sendingRequest && <Loader2 className="h-4 w-4 animate-spin" />}
              {sendingRequest ? 'Updating...' : 'Update Visit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Complete Visit</DialogTitle>
            <DialogDescription className="text-sm">
              {completeRole === 'SUPPORT'
                ? 'Submit project details for your support visit.'
                : 'Submit visit outcome. This marks visit complete and updates lead stage automatically.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {completeRole === 'LEAD' &&
            completeVisit &&
            (completeVisit.supportAssignments ?? []).some((item) => !item.result) ? (
              <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                This visit cannot be completed yet. Support members must submit their support data first.
              </div>
            ) : null}
            {completeRole === 'SUPPORT' ? (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Client Name</Label>
                  <Input value={supportClientName} onChange={(event) => setSupportClientName(event.target.value)} className="text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Project Area</Label>
                  <Input value={supportProjectArea} onChange={(event) => setSupportProjectArea(event.target.value)} className="text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Project Status</Label>
                  <Input value={supportProjectStatus} onChange={(event) => setSupportProjectStatus(event.target.value)} className="text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Extra Concern (optional)</Label>
                  <Textarea
                    value={supportExtraConcern}
                    onChange={(event) => setSupportExtraConcern(event.target.value)}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Summary</Label>
                  <Textarea
                    value={completeSummary}
                    onChange={(event) => setCompleteSummary(event.target.value)}
                    rows={3}
                    placeholder="What happened in this visit?"
                    className="text-sm resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Client Mood (optional)</Label>
                  <Select
                    value={completeClientMood || selectUnsetValue}
                    onValueChange={(value) =>
                      setCompleteClientMood(value === selectUnsetValue ? '' : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select client mood" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={selectUnsetValue}>None</SelectItem>
                      {clientMoodOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex flex-col">
                            <span>{option.label}</span>
                            {option.description ? (
                              <span className="text-xs text-muted-foreground">{option.description}</span>
                            ) : null}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <Select
                    value={completeClientPotentiality || selectUnsetValue}
                    onValueChange={(value) =>
                      setCompleteClientPotentiality(value === selectUnsetValue ? '' : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select potentiality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={selectUnsetValue}>None</SelectItem>
                      {clientPotentialityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={completeProjectType || selectUnsetValue}
                    onValueChange={(value) =>
                      setCompleteProjectType(value === selectUnsetValue ? '' : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={selectUnsetValue}>None</SelectItem>
                      {projectTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="md:col-span-2">
                    <Select
                      value={completeClientPersonality || selectUnsetValue}
                      onValueChange={(value) =>
                        setCompleteClientPersonality(value === selectUnsetValue ? '' : value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select client personality" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={selectUnsetValue}>None</SelectItem>
                        {clientPersonalityOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex flex-col">
                              <span>{option.label}</span>
                              {option.description ? (
                                <span className="text-xs text-muted-foreground">{option.description}</span>
                              ) : null}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Select
                    value={completeBudgetRange || selectUnsetValue}
                    onValueChange={(value) =>
                      setCompleteBudgetRange(value === selectUnsetValue ? '' : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select budget range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={selectUnsetValue}>None</SelectItem>
                      {budgetRangeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={completeTimelineUrgency || selectUnsetValue}
                    onValueChange={(value) =>
                      setCompleteTimelineUrgency(value === selectUnsetValue ? '' : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select urgency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={selectUnsetValue}>None</SelectItem>
                      {urgencyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={completeStylePreference || selectUnsetValue}
                    onValueChange={(value) =>
                      setCompleteStylePreference(value === selectUnsetValue ? '' : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select style preference" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={selectUnsetValue}>None</SelectItem>
                      {stylePreferenceOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Project Status (optional)</Label>
                  <select
                    value={completeProjectStatus}
                    onChange={(event) => setCompleteProjectStatus(event.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select project status</option>
                    <option value="UNDER_CONSTRUCTION">UNDER_CONSTRUCTION</option>
                    <option value="READY">READY</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Note (optional)</Label>
                  <Textarea
                    value={completeNote}
                    onChange={(event) => setCompleteNote(event.target.value)}
                    rows={2}
                    placeholder="Add note"
                    className="text-sm resize-none"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Attachments (optional)</Label>
              <Input
                type="file"
                multiple
                onChange={(event) => setCompleteFiles(Array.from(event.target.files ?? []))}
                className="text-sm"
              />
              {completeFiles.length > 0 ? (
                <p className="text-xs text-muted-foreground">{completeFiles.length} file(s) selected</p>
              ) : null}
            </div>
            {completeError ? (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {completeError}
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCompleteOpen(false)} className="text-sm">
              Close
            </Button>
            <Button
              onClick={handleCompleteVisit}
              disabled={
                submittingComplete ||
                (completeRole === 'LEAD' &&
                  Boolean(completeVisit?.supportAssignments?.some((item) => !item.result)))
              }
              className="text-sm gap-2"
            >
              {submittingComplete && <Loader2 className="h-4 w-4 animate-spin" />}
              {submittingComplete
                ? 'Submitting...'
                : completeRole === 'SUPPORT'
                  ? 'Submit Support Data'
                  : 'Complete Visit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={supportDialogOpen}
        onOpenChange={(open) => {
          setSupportDialogOpen(open)
          if (!open) {
            setSupportDialogVisitId('')
            setSupportDialogSelection('')
            setSupportDialogMembers([])
            setSupportDialogError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Support Member</DialogTitle>
            <DialogDescription>
              Assign a support member for this visit from this page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Support Member</Label>
              <select
                value={supportDialogSelection}
                onChange={(event) => setSupportDialogSelection(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={supportDialogLoading}
              >
                <option value="">
                  {supportDialogLoading
                    ? 'Loading visit team members...'
                    : supportDialogMembers.length === 0
                      ? 'No available members'
                      : 'Select support member'}
                </option>
                {supportDialogMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName} ({member.email})
                  </option>
                ))}
              </select>
            </div>
            {supportDialogError ? (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {supportDialogError}
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              onClick={handleAddSupportMember}
              disabled={supportDialogSaving || supportDialogLoading || !supportDialogSelection}
              className="text-sm gap-2"
            >
              {supportDialogSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {supportDialogSaving ? 'Saving...' : 'Add Support Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
