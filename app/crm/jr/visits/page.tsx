'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, MapPin, Clock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { fetchMeCached } from '@/lib/client-me'
import { toast } from '@/components/ui/sonner'
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
  leadId: string
  scheduledAt: string
  location: string
  projectSqft: number | null
  projectStatus: string | null
  status: string
  notes: string | null
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
  createdBy: {
    id: string
    fullName: string
  } | null
}

type ApiResponse = {
  success: boolean
  data?: VisitRecord[]
  error?: string
}

type VisitTeamMember = {
  id: string
  fullName: string
  email: string
}

type SupportMemberOption = {
  id: string
  fullName: string
  email: string
}

type VisitsCacheEntry = {
  savedAt: number
  data: VisitRecord[]
}

const VISITS_CACHE_TTL_MS = 60_000
let visitsCacheByScope: Record<string, VisitsCacheEntry | undefined> = {}
const visitsRequestPromiseByScope: Record<string, Promise<VisitRecord[]> | undefined> = {}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  SCHEDULED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  rescheduled: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  RESCHEDULED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
}

const formatVisitStatus = (status: string) => (status === 'SCHEDULED' ? 'PENDING' : status)
const calendarWeekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const selectUnsetValue = '__UNSET__'

type VisitsPageProps = {
  forceAssignedOnly?: boolean
  leadHrefPrefix?: string
  restrictToCreator?: boolean
  allowCompleteVisit?: boolean
  blurUnassignedVisitDetails?: boolean
  visitScope?: 'default' | 'all'
  allowManageAssignment?: boolean
}

export function VisitsPageView({
  forceAssignedOnly = false,
  leadHrefPrefix = '/crm/jr/leads',
  restrictToCreator = true,
  allowCompleteVisit = false,
  blurUnassignedVisitDetails = false,
  visitScope = 'default',
  allowManageAssignment = true,
}: VisitsPageProps) {
  const [activeTab, setActiveTab] = useState('calendar')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [visits, setVisits] = useState<VisitRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [completeVisitId, setCompleteVisitId] = useState('')
  const [completeRole, setCompleteRole] = useState<'LEAD' | 'SUPPORT'>('LEAD')
  const [completeSummary, setCompleteSummary] = useState('')
  const [completeClientMood, setCompleteClientMood] = useState('')
  const [completeNote, setCompleteNote] = useState('')
  const [completeProjectStatus, setCompleteProjectStatus] = useState('')
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
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignVisitId, setAssignVisitId] = useState('')
  const [assignMemberId, setAssignMemberId] = useState('')
  const [assignReason, setAssignReason] = useState('Visit assignment updated.')
  const [assignMembers, setAssignMembers] = useState<VisitTeamMember[]>([])
  const [assignError, setAssignError] = useState<string | null>(null)
  const [assignLoadingMembers, setAssignLoadingMembers] = useState(false)
  const [assignSaving, setAssignSaving] = useState(false)
  const [supportDialogOpen, setSupportDialogOpen] = useState(false)
  const [supportDialogVisitId, setSupportDialogVisitId] = useState('')
  const [supportDialogError, setSupportDialogError] = useState<string | null>(null)
  const [supportDialogSelection, setSupportDialogSelection] = useState('')
  const [supportDialogMembers, setSupportDialogMembers] = useState<SupportMemberOption[]>([])
  const [supportDialogLoading, setSupportDialogLoading] = useState(false)
  const [supportDialogSaving, setSupportDialogSaving] = useState(false)

  const formatLocalDateKey = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  useEffect(() => {
    setSelectedDate(formatLocalDateKey(new Date()))
  }, [])

  useEffect(() => {
    const loadVisits = async () => {
      const scopeKey = visitScope
      try {
        const cached = visitsCacheByScope[scopeKey] ?? null
        const cacheIsFresh =
          cached && Date.now() - cached.savedAt < VISITS_CACHE_TTL_MS
        if (cacheIsFresh) {
          setVisits(cached.data)
          setError(null)
          return
        }

        if (!visitsRequestPromiseByScope[scopeKey]) {
          visitsRequestPromiseByScope[scopeKey] = (async () => {
            const response = await fetch(`/api/visit-schedule${visitScope === 'all' ? '?scope=all' : ''}`)
            const payload = (await response.json()) as ApiResponse
            if (!response.ok || !payload.success) {
              const message =
                payload?.error
                  ? String(payload.error)
                  : `Failed to load visits (status ${response.status})`
              throw new Error(message)
            }
            return payload.data ?? []
          })()
            .finally(() => {
              delete visitsRequestPromiseByScope[scopeKey]
            })
        }

        const nextVisits = await visitsRequestPromiseByScope[scopeKey]
        visitsCacheByScope[scopeKey] = { data: nextVisits, savedAt: Date.now() }
        setVisits(nextVisits)
        setError(null)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load visits'
        console.error('Error loading visits:', error)
        setError(message)
        setVisits([])
      } finally {
        setLoading(false)
      }
    }

    loadVisits()
  }, [visitScope])

  useEffect(() => {
    if (typeof window === 'undefined') return

    fetchMeCached()
      .then((data) => {
        if (data?.id) {
          setCurrentUserId(String(data.id))
        }
      })
      .catch((error) => {
        console.error('Error loading current user:', error)
      })
  }, [])

  const normalizedSearch = searchTerm.trim().toLowerCase()
  const numericSearch = searchTerm.replace(/\D/g, '')

  const filteredVisits = useMemo(() => {
    if (!normalizedSearch && !numericSearch) return visits

    return visits.filter((visit) => {
      const leadName = visit.lead?.name?.toLowerCase() ?? ''
      const leadPhone = visit.lead?.phone?.replace(/\D/g, '') ?? ''
      const nameMatch = normalizedSearch ? leadName.includes(normalizedSearch) : false
      const phoneMatch = numericSearch ? leadPhone.includes(numericSearch) : false
      return nameMatch || phoneMatch
    })
  }, [visits, normalizedSearch, numericSearch])

  const scheduledVisits = useMemo(
    () => filteredVisits.filter((v) => v.status === 'SCHEDULED'),
    [filteredVisits]
  )
  const completedVisits = useMemo(
    () => filteredVisits.filter((v) => v.status === 'COMPLETED'),
    [filteredVisits]
  )

  // Group visits by date (YYYY-MM-DD from ISO string)
  const visitsByDate = useMemo(() => {
    const grouped: Record<string, VisitRecord[]> = {}
    visits.forEach((visit) => {
      const scheduledDate = new Date(visit.scheduledAt)
      const dateStr = Number.isNaN(scheduledDate.getTime())
        ? visit.scheduledAt.split('T')[0]
        : formatLocalDateKey(scheduledDate)
      if (!grouped[dateStr]) grouped[dateStr] = []
      grouped[dateStr].push(visit)
    })
    return grouped
  }, [visits])

  // Get calendar days for current month
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDayOfMonth(currentDate)
  const calendarDays: Array<number | null> = [
    ...Array.from({ length: firstDay }, () => null as null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const getDateString = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    return formatLocalDateKey(date)
  }

  const getVisitsForDay = (day: number) => {
    const dateStr = getDateString(day)
    return visitsByDate[dateStr] || []
  }

  const mobileCalendarRows = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1
      const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      const dateString = formatLocalDateKey(dateObj)
      const dayLabel = calendarWeekLabels[dateObj.getDay()]
      return {
        day,
        dateString,
        dayLabel,
        visits: visitsByDate[dateString] || [],
      }
    })
  }, [currentDate, daysInMonth, visitsByDate])

  const canViewVisit = (visit: VisitRecord) => {
    if (blurUnassignedVisitDetails) {
      return getVisitRole(visit) !== 'NONE'
    }
    if (forceAssignedOnly) return true
    if (!restrictToCreator) return true
    const creatorId = visit.createdBy?.id
    if (!currentUserId || !creatorId) return true
    return creatorId === currentUserId
  }

  const getVisitRole = (visit: VisitRecord): 'LEAD' | 'SUPPORT' | 'NONE' => {
    if (!currentUserId) return 'NONE'
    if (visit.assignedTo?.id === currentUserId) return 'LEAD'
    const isSupport = (visit.supportAssignments ?? []).some((item) => item.supportUserId === currentUserId)
    return isSupport ? 'SUPPORT' : 'NONE'
  }

  const restrictedMessage = blurUnassignedVisitDetails
    ? 'Restricted to assigned team'
    : 'Restricted to assigned CRM'

  const canManageSupportForVisit = (visit: VisitRecord) => {
    if (!currentUserId) return false
    return visit.assignedTo?.id === currentUserId
  }

  const openCompleteDialog = (visit: VisitRecord) => {
    const role = getVisitRole(visit)
    if (role === 'NONE') return
    setCompleteVisitId(visit.id)
    setCompleteRole(role)
    setCompleteSummary('')
    setCompleteClientMood('')
    setCompleteNote('')
    setCompleteProjectStatus('')
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

  const openAssignDialog = async (visit: VisitRecord) => {
    setAssignVisitId(visit.id)
    setAssignMemberId(visit.assignedTo?.id ?? '')
    setAssignReason('Visit assignment updated.')
    setAssignError(null)
    setAssignOpen(true)
    if (assignMembers.length > 0) return
    setAssignLoadingMembers(true)
    try {
      const response = await fetch('/api/department/available/VISIT_TEAM', {
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to load visit team members')
      }
      const members = Array.isArray(payload.users) ? payload.users : []
      setAssignMembers(
        members.map((member: VisitTeamMember) => ({
          id: member.id,
          fullName: member.fullName,
          email: member.email,
        })),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load visit team members'
      setAssignError(message)
      toast.error(message)
    } finally {
      setAssignLoadingMembers(false)
    }
  }

  const submitAssignVisit = async () => {
    if (!assignVisitId) return
    if (!assignMemberId) {
      setAssignError('Please select a visit member.')
      return
    }

    setAssignSaving(true)
    setAssignError(null)
    try {
      const response = await fetch(`/api/visit-schedule/${assignVisitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitTeamUserId: assignMemberId,
          reason: assignReason.trim() || 'Visit assignment updated.',
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to update visit assignment')
      }

      visitsCacheByScope = {}
      const refreshResponse = await fetch(`/api/visit-schedule${visitScope === 'all' ? '?scope=all' : ''}`, {
        cache: 'no-store',
      })
      const refreshPayload = (await refreshResponse.json()) as ApiResponse
      if (!refreshResponse.ok || !refreshPayload.success) {
        throw new Error(refreshPayload?.error || 'Failed to refresh visits')
      }
      visitsCacheByScope[visitScope] = { data: refreshPayload.data ?? [], savedAt: Date.now() }
      setVisits(refreshPayload.data ?? [])
      setAssignOpen(false)
      setAssignVisitId('')
      setAssignMemberId('')
      setAssignReason('Visit assignment updated.')
      toast.success('Visit assignment updated.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update visit assignment'
      setAssignError(message)
      toast.error(message)
    } finally {
      setAssignSaving(false)
    }
  }

  const openSupportDialog = async (visit: VisitRecord) => {
    setSupportDialogVisitId(visit.id)
    setSupportDialogOpen(true)
    setSupportDialogSelection('')
    setSupportDialogError(null)
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

  const submitAddSupportMember = async () => {
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

      const selectedMember = supportDialogMembers.find((member) => member.id === supportDialogSelection) ?? null
      setVisits((prev) =>
        prev.map((visit) => {
          if (visit.id !== supportDialogVisitId || !selectedMember) return visit
          const existing = visit.supportAssignments ?? []
          if (existing.some((item) => item.supportUserId === selectedMember.id)) return visit
          return {
            ...visit,
            supportAssignments: [
              ...existing,
              {
                id: payload?.data?.id ?? `temp-${selectedMember.id}`,
                supportUserId: selectedMember.id,
                supportUser: {
                  id: selectedMember.id,
                  fullName: selectedMember.fullName,
                  email: selectedMember.email,
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

  const removeSupportMember = async (visitId: string, supportUserId: string) => {
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

  const submitCompleteVisit = async () => {
    if (!completeVisitId) return
    const currentVisit = visits.find((visit) => visit.id === completeVisitId) ?? null
    const pendingSupportCount =
      completeRole === 'LEAD'
        ? (currentVisit?.supportAssignments ?? []).filter((item) => !item.result).length
        : 0
    if (pendingSupportCount > 0) {
      setCompleteError('Visit cannot be completed until all support members submit their support data.')
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
        if (completeNote.trim()) formData.append('note', completeNote.trim())
        if (completeProjectStatus) formData.append('projectStatus', completeProjectStatus)
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

      const res = await fetch(`/api/visit-schedule/${completeVisitId}/result`, {
        method: 'POST',
        body: formData,
      })

      const payload = await res.json()
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to complete visit')
      }

      visitsCacheByScope = {}
      setCompleteOpen(false)
      setCompleteVisitId('')
      setCompleteSummary('')
      setCompleteClientMood('')
      setCompleteNote('')
      setCompleteProjectStatus('')
      setCompleteFiles([])
      toast.success(completeRole === 'SUPPORT' ? 'Support data submitted.' : 'Visit marked as completed.')

      setLoading(true)
      const response = await fetch(`/api/visit-schedule${visitScope === 'all' ? '?scope=all' : ''}`)
      const freshPayload = (await response.json()) as ApiResponse
      if (!response.ok || !freshPayload.success) {
        throw new Error(freshPayload?.error || 'Failed to refresh visits')
      }
      visitsCacheByScope[visitScope] = { data: freshPayload.data ?? [], savedAt: Date.now() }
      setVisits(freshPayload.data ?? [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to complete visit'
      setCompleteError(message)
      toast.error(message)
    } finally {
      setSubmittingComplete(false)
      setLoading(false)
    }
  }

  const VisitCard = ({ visit }: { visit: VisitRecord }) => {
    const isVisible = canViewVisit(visit)
    const leadHref = `${leadHrefPrefix}/${visit.lead.id}`
    const visitRole = getVisitRole(visit)
    const canComplete = allowCompleteVisit && visit.status !== 'COMPLETED' && visitRole !== 'NONE'

    return (
      <Card className="mb-3 overflow-hidden relative">
        {!isVisible ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-xs font-semibold text-muted-foreground bg-background/70">
            {restrictedMessage}
          </div>
        ) : null}
        <CardContent className={`pt-6 ${!isVisible ? 'blur-xs pointer-events-none select-none' : ''}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold text-foreground">{visit.lead?.name || 'Unknown'}</h3>
                <p className="text-xs text-muted-foreground">{visit.lead?.location || 'N/A'}</p>
              </div>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span>
                    {new Date(visit.scheduledAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    at{' '}
                    {new Date(visit.scheduledAt).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{visit.location}</span>
                </div>
                {visit.projectSqft ? (
                  <p className="text-xs text-muted-foreground">Sqft: {visit.projectSqft}</p>
                ) : null}
                {visit.projectStatus ? (
                  <p className="text-xs text-muted-foreground">
                    Project Status: {visit.projectStatus.replace(/_/g, ' ')}
                  </p>
                ) : null}
                {visit.notes && <p className="text-xs text-muted-foreground italic mt-2">{visit.notes}</p>}
                <p className="text-xs text-muted-foreground">
                  Assigned: {visit.assignedTo?.fullName || 'Unassigned'}
                </p>
                <div className="rounded-md border border-border bg-muted/40 p-2 text-xs">
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
                              onClick={() => void removeSupportMember(visit.id, item.supportUserId)}
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
                <div className="pt-1">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={leadHref}>Open Lead Details</Link>
                    </Button>
                    {allowManageAssignment ? (
                      <Button size="sm" variant="outline" onClick={() => openAssignDialog(visit)}>
                        {visit.assignedTo ? 'Reassign' : 'Assign'}
                      </Button>
                    ) : null}
                    {canComplete && (
                      <Button size="sm" variant="outline" onClick={() => openCompleteDialog(visit)}>
                        {visitRole === 'SUPPORT' ? 'Submit Support Data' : 'Complete Visit'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusColors[visit.status]}`}
            >
              {formatVisitStatus(visit.status)}
            </span>
          </div>
          {visitRole !== 'NONE' ? (
            <div className="pt-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  visitRole === 'LEAD'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                }`}
              >
                {visitRole === 'LEAD' ? 'Leading' : 'Supporting'}
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="Visits"
        subtitle="Schedule and manage site visits"
      />
      <main className="mx-auto max-w-[1440px] px-6 py-6 space-y-6">
        <div className="flex items-center justify-end">
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Schedule Visit
        </Button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading visits...</p> : null}
      {!loading && error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>{monthYear}</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrevMonth}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleNextMonth}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="hidden sm:grid grid-cols-7 gap-2">
                    {calendarWeekLabels.map((day) => (
                      <div key={day} className="text-center font-semibold text-muted-foreground text-sm py-2">
                        {day}
                      </div>
                    ))}
                    {loading
                      ? Array.from({ length: 35 }).map((_, idx) => (
                          <div key={idx} className="aspect-square rounded-lg border bg-muted/60 animate-pulse" />
                        ))
                      : calendarDays.map((day, idx) => {
                          const visitsForDay = day ? getVisitsForDay(day) : []
                          const dateStr = day ? getDateString(day) : null
                          const isSelected = selectedDate === dateStr

                          const leadCount = visitsForDay.filter((visit) => getVisitRole(visit) === 'LEAD').length
                          const supportCount = visitsForDay.filter((visit) => getVisitRole(visit) === 'SUPPORT').length
                          return (
                            <div
                              key={idx}
                              onClick={() => day && setSelectedDate(dateStr)}
                              className={`aspect-square p-2 border rounded-lg text-center cursor-pointer transition-colors ${
                                !day
                                  ? 'bg-muted'
                                  : isSelected
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : visitsForDay.length > 0
                                      ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-400'
                                      : 'hover:border-gray-400'
                              }`}
                            >
                              {day && (
                                <div className="flex flex-col items-center justify-center h-full">
                                  <span className="font-semibold text-sm">{day}</span>
                                  {visitsForDay.length > 0 && (
                                    <div className="mt-1 flex items-center gap-1">
                                      <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 text-[10px] font-bold text-white bg-slate-700 rounded-full">
                                        {visitsForDay.length}
                                      </span>
                                      {leadCount > 0 ? (
                                        <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 text-[10px] font-bold text-white bg-blue-500 rounded-full">
                                          {leadCount}
                                        </span>
                                      ) : null}
                                      {supportCount > 0 ? (
                                        <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 text-[10px] font-bold text-white bg-emerald-500 rounded-full">
                                          {supportCount}
                                        </span>
                                      ) : null}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                  </div>

                  <div className="space-y-2 sm:hidden">
                    {loading
                      ? Array.from({ length: 6 }).map((_, idx) => (
                          <div key={idx} className="h-20 rounded-lg border bg-muted/60 animate-pulse" />
                        ))
                      : mobileCalendarRows.map((row) => {
                          const isSelected = selectedDate === row.dateString
                          const leadCount = row.visits.filter((visit) => getVisitRole(visit) === 'LEAD').length
                          const supportCount = row.visits.filter((visit) => getVisitRole(visit) === 'SUPPORT').length
                          return (
                            <div
                              key={row.dateString}
                              className={`w-full rounded-lg border p-3 transition ${
                                isSelected
                                  ? 'border-primary bg-primary/5'
                                  : row.visits.length > 0
                                    ? 'border-blue-300 bg-blue-50/70 dark:bg-blue-900/20'
                                    : 'border-border bg-card'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedDate(row.dateString)}
                                className="w-full text-left"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs text-muted-foreground">{row.dayLabel}</p>
                                    <p className="text-sm font-semibold text-foreground">
                                      {monthYear.split(' ')[0]} {row.day}
                                    </p>
                                  </div>
                                  <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                                    {row.visits.length}
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center gap-1 text-[10px]">
                                  <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">Lead {leadCount}</span>
                                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">Support {supportCount}</span>
                                </div>
                              </button>

                              {row.visits.length > 0 ? (
                                <div className="mt-2 space-y-2">
                                  {row.visits.slice(0, 3).map((visit) => {
                                    const isVisible = canViewVisit(visit)
                                    const role = getVisitRole(visit)
                                    return (
                                      <div
                                        key={visit.id}
                                        className="rounded-md border border-border bg-card p-2 text-xs relative overflow-hidden"
                                      >
                                        {!isVisible ? (
                                          <div className="absolute inset-0 z-10 flex items-center justify-center text-[10px] font-semibold text-muted-foreground bg-background/70">
                                            {restrictedMessage}
                                          </div>
                                        ) : null}
                                        <div className={`space-y-1 ${!isVisible ? 'blur-xs pointer-events-none select-none' : ''}`}>
                                          <p className="font-semibold text-foreground">{visit.lead?.name || 'Unknown Lead'}</p>
                                          <p className="text-muted-foreground">
                                            {new Date(visit.scheduledAt).toLocaleTimeString('en-US', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })}
                                          </p>
                                          <p className="text-[10px] text-muted-foreground">
                                            Support:{' '}
                                            {(visit.supportAssignments ?? []).length > 0
                                              ? (visit.supportAssignments ?? []).map((item) => item.supportUser.fullName).join(', ')
                                              : 'None'}
                                          </p>
                                          <div>
                                            <Button size="sm" variant="outline" asChild className="h-6 px-2 text-[10px]">
                                              <Link href={`${leadHrefPrefix}/${visit.lead.id}`}>Open Lead</Link>
                                            </Button>
                                          </div>
                                          {role !== 'NONE' ? (
                                            <p className="text-[10px] font-semibold text-muted-foreground">
                                              {role === 'LEAD' ? 'Leading' : 'Supporting'}
                                            </p>
                                          ) : null}
                                        </div>
                                      </div>
                                    )
                                  })}
                                  {row.visits.length > 3 ? (
                                    <p className="text-[11px] text-muted-foreground font-medium">
                                      +{row.visits.length - 3} more visit(s)
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="hidden sm:block">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {selectedDate
                      ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Select a Day'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, idx) => (
                        <div key={idx} className="rounded-lg border p-3 space-y-2 animate-pulse">
                          <div className="h-4 w-36 rounded bg-muted" />
                          <div className="h-3 w-24 rounded bg-muted" />
                          <div className="h-3 w-full rounded bg-muted" />
                        </div>
                      ))}
                    </div>
                  ) : selectedDate && visitsByDate[selectedDate] ? (
                    <div className="space-y-3">
                      {visitsByDate[selectedDate].map((visit) => {
                        const isVisible = canViewVisit(visit)
                        const role = getVisitRole(visit)
                        return (
                          <div
                            key={visit.id}
                            className="p-3 border rounded-lg space-y-2 bg-muted/50 relative overflow-hidden"
                          >
                            {!isVisible ? (
                              <div className="absolute inset-0 z-10 flex items-center justify-center text-[10px] font-semibold text-muted-foreground bg-background/70">
                                {restrictedMessage}
                              </div>
                            ) : null}
                            <div className={!isVisible ? 'blur-xs pointer-events-none select-none' : ''}>
                              <div>
                                <h4 className="font-semibold text-sm">{visit.lead?.name || 'Unknown'}</h4>
                                <p className="text-xs text-muted-foreground">{visit.lead?.location}</p>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {new Date(visit.scheduledAt).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                <span className="line-clamp-2">{visit.location}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Support:{' '}
                                {(visit.supportAssignments ?? []).length > 0
                                  ? (visit.supportAssignments ?? []).map((item) => item.supportUser.fullName).join(', ')
                                  : 'None'}
                              </p>
                              <span
                                className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                  statusColors[visit.status]
                                }`}
                              >
                                {formatVisitStatus(visit.status)}
                              </span>
                              {role !== 'NONE' ? (
                                <span
                                  className={`ml-2 inline-block px-2 py-1 rounded text-[10px] font-semibold ${
                                    role === 'LEAD'
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
                                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                                  }`}
                                >
                                  {role === 'LEAD' ? 'Leading' : 'Supporting'}
                                </span>
                              ) : null}
                              <div className="pt-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  asChild
                                  className="h-7 px-2 text-[11px]"
                                >
                                  <Link href={`${leadHrefPrefix}/${visit.lead.id}`}>Open Lead</Link>
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {selectedDate ? 'No visits scheduled' : 'Click on a day to see visits'}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by lead name or phone"
                className="max-w-sm"
              />
              {searchTerm ? (
                <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')}>
                  Clear
                </Button>
              ) : null}
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="mb-3 font-semibold text-foreground">Scheduled ({scheduledVisits.length})</h3>
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <Card key={idx} className="border-border animate-pulse">
                        <CardContent className="h-44" />
                      </Card>
                    ))}
                  </div>
                ) : scheduledVisits.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {scheduledVisits.map((visit) => (
                      <VisitCard key={visit.id} visit={visit} />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No scheduled visits</p>
                )}
              </div>
              <div>
                <h3 className="mb-3 font-semibold text-foreground">Completed ({completedVisits.length})</h3>
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <Card key={idx} className="border-border animate-pulse">
                        <CardContent className="h-44" />
                      </Card>
                    ))}
                  </div>
                ) : completedVisits.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {completedVisits.map((visit) => (
                      <VisitCard key={visit.id} visit={visit} />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No completed visits</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Visit</DialogTitle>
            <DialogDescription>
              {completeRole === 'SUPPORT'
                ? 'Submit project details as support member.'
                : 'Submit visit outcome to mark this visit as completed and update lead stage automatically.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {completeRole === 'LEAD' &&
            completeVisitId &&
            visits
              .find((visit) => visit.id === completeVisitId)
              ?.supportAssignments?.some((item) => !item.result) ? (
              <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                This visit cannot be completed yet. Support members must submit their support data first.
              </div>
            ) : null}
            {completeRole === 'SUPPORT' ? (
              <>
                <div className="space-y-2">
                  <Label>Client Name</Label>
                  <Input value={supportClientName} onChange={(e) => setSupportClientName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Project Area</Label>
                  <Input value={supportProjectArea} onChange={(e) => setSupportProjectArea(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Project Status</Label>
                  <Input value={supportProjectStatus} onChange={(e) => setSupportProjectStatus(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Extra Concern (optional)</Label>
                  <Textarea value={supportExtraConcern} onChange={(e) => setSupportExtraConcern(e.target.value)} rows={2} />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Meeting Summary</Label>
                  <Textarea
                    value={completeSummary}
                    onChange={(event) => setCompleteSummary(event.target.value)}
                    rows={3}
                    placeholder="What happened during this visit?"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Client Mood (optional)</Label>
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
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Potentiality / Hotness</Label>
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
                  </div>
                  <div className="space-y-2">
                    <Label>Project Type</Label>
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
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Client Personality</Label>
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
                  <div className="space-y-2">
                    <Label>Budget Range</Label>
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
                  </div>
                  <div className="space-y-2">
                    <Label>Urgency</Label>
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
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Style Preference</Label>
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
                </div>
                <div className="space-y-2">
                  <Label>Project Status (optional)</Label>
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
                  <Label>Note (optional)</Label>
                  <Textarea
                    value={completeNote}
                    onChange={(event) => setCompleteNote(event.target.value)}
                    rows={2}
                    placeholder="Add follow-up note if needed"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Attachments (optional)</Label>
              <Input
                type="file"
                multiple
                onChange={(event) => setCompleteFiles(Array.from(event.target.files ?? []))}
              />
              {completeFiles.length > 0 ? (
                <p className="text-xs text-muted-foreground">{completeFiles.length} file(s) selected</p>
              ) : null}
            </div>
            {completeError ? <p className="text-sm text-destructive">{completeError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>
              Close
            </Button>
            <Button
              onClick={submitCompleteVisit}
              disabled={
                submittingComplete ||
                (completeRole === 'LEAD' &&
                  Boolean(
                    visits
                      .find((visit) => visit.id === completeVisitId)
                      ?.supportAssignments?.some((item) => !item.result),
                  ))
              }
            >
              {submittingComplete ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                completeRole === 'SUPPORT' ? 'Submit Support Data' : 'Complete Visit'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Visit Member</DialogTitle>
            <DialogDescription>
              Assign or reassign this visit to a Visit Team member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Visit Team Member</Label>
              <select
                value={assignMemberId}
                onChange={(event) => setAssignMemberId(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={assignLoadingMembers}
              >
                <option value="">{assignLoadingMembers ? 'Loading members...' : 'Select member'}</option>
                {assignMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName} ({member.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={assignReason}
                onChange={(event) => setAssignReason(event.target.value)}
                rows={3}
              />
            </div>
            {assignError ? <p className="text-sm text-destructive">{assignError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Close
            </Button>
            <Button onClick={submitAssignVisit} disabled={assignSaving || assignLoadingMembers}>
              {assignSaving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Assignment'
              )}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Support Member</DialogTitle>
            <DialogDescription>
              Assign a support member for this visit without opening lead details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Support Member</Label>
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
            {supportDialogError ? <p className="text-sm text-destructive">{supportDialogError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              onClick={submitAddSupportMember}
              disabled={supportDialogSaving || supportDialogLoading || !supportDialogSelection}
            >
              {supportDialogSaving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Add Support Member'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </main>
    </div>
  )
}

export default function VisitsPage() {
  return <VisitsPageView />
}
