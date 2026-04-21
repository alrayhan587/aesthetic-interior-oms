'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { User, TrendingUp, Plus, Mail, MessageCircle } from 'lucide-react'
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

type Assignment = {
  id: string
  leadId: string
  userId: string
  department: string
  createdAt: string
  user: {
    id: string
    fullName: string
    email: string
  }
}

type VisitTeamUser = {
  id: string
  fullName: string
  email: string
  phone?: string | null
}
type ScheduledVisitCard = {
  id: string
  scheduledAt: string
  location: string
  visitFee?: number | null
  projectSqft?: number | null
  projectStatus?: string | null
  notes?: string | null
  assignedToName: string
  assignedToEmail: string
}
type LeadVisitRecord = {
  id: string
  scheduledAt: string
  status: string
  location: string
  visitFee?: number | null
  projectSqft?: number | null
  projectStatus?: string | null
  notes: string | null
  updateRequests?: Array<{
    id: string
    type: string
    reason: string
    createdAt: string
    requestedScheduleAt?: string | null
    requestedBy?: {
      id: string
      fullName: string
      email: string
    } | null
  }>
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
  result?: {
    id: string
    summary: string
    clientMood?: string | null
    completedAt: string
    files: Array<{
      id: string
      url: string
      fileName: string
      fileType: string
      createdAt: string
    }>
  } | null
  assignedTo: {
    id: string
    fullName: string
    email: string
  } | null
  createdBy: {
    id: string
    fullName: string
  } | null
}

type VisitSupportMemberOption = {
  id: string
  fullName: string
  email: string
}
type VisitResultRole = 'LEAD' | 'SUPPORT' | 'NONE'

interface LeadActionsPanelProps {
  leadId: string
  leadLocation?: string | null
  leadPhone?: string | null
  leadEmail?: string | null
  hasPendingFollowup?: boolean
  assignments: Assignment[]
  assignmentsLoading: boolean
  canManageAssignments?: boolean
  canManageStage?: boolean
  canSetVisitCompletedStage?: boolean
  canAddFollowup?: boolean
  canScheduleVisit?: boolean
  canSubmitVisitResult?: boolean
  canOverrideVisitLeadRole?: boolean
  currentUserId?: string | null
  blurVisitResult?: boolean
  canManageVisitRequests?: boolean
  restrictStagesForJrCrm?: boolean
  stage: string
  originalStage: string
  subStatus: string | null
  originalSubStatus: string | null
  onStageChange: (value: string) => void
  onSubStatusChange: (value: string | null) => void
  onUpdateStage: (reason: string) => Promise<void>
  onCreateFollowupForStage?: (payload: { followupDate: string; notes?: string }) => Promise<void>
  onAssignmentsRefresh: () => void
  onFollowupRefresh?: () => void
  onAttachmentRefresh?: () => void
  onAddFollowup: () => void
  onAddAttachment?: () => void
  onAddLeadDetails?: () => void
  onLeadRefresh?: () => void
  openScheduleOnMount?: boolean
}

function toHourPrecisionLocalDateTime(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2}T\d{2})(?::\d{2})?/)
  if (!match?.[1]) return trimmed
  return `${match[1]}:00`
}

function formatDateToLocalHourInput(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:00`
}

const dateTimeInputClassName =
  'dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80 dark:[&::-webkit-calendar-picker-indicator]:invert dark:[&::-webkit-calendar-picker-indicator]:brightness-200'
const selectUnsetValue = '__UNSET__'

export function LeadActionsPanel({
  leadId,
  leadLocation,
  leadPhone,
  leadEmail,
  hasPendingFollowup = false,
  assignments,
  assignmentsLoading,
  canManageAssignments = true,
  canManageStage = true,
  canSetVisitCompletedStage = true,
  canAddFollowup = true,
  canScheduleVisit = true,
  canSubmitVisitResult = false,
  canOverrideVisitLeadRole = false,
  currentUserId = null,
  blurVisitResult = false,
  canManageVisitRequests = false,
  restrictStagesForJrCrm = false,
  stage,
  originalStage,
  subStatus,
  originalSubStatus,
  onStageChange,
  onSubStatusChange,
  onUpdateStage,
  onCreateFollowupForStage,
  onAssignmentsRefresh,
  onFollowupRefresh,
  onAttachmentRefresh,
  onAddFollowup,
  onAddAttachment,
  onAddLeadDetails,
  onLeadRefresh,
  openScheduleOnMount,
}: LeadActionsPanelProps) {
  const [assignOpen, setAssignOpen] = useState(false)
  const [department, setDepartment] = useState('')
  const [departmentUsers, setDepartmentUsers] = useState<Assignment['user'][]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [reasonOpen, setReasonOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [didClearDefaultReason, setDidClearDefaultReason] = useState(false)
  const [stageFollowupDate, setStageFollowupDate] = useState('')
  const [stageFollowupNotes, setStageFollowupNotes] = useState('')
  const [stagePhone, setStagePhone] = useState(leadPhone ?? '')
  const [stageError, setStageError] = useState<string | null>(null)
  const [savingStage, setSavingStage] = useState(false)
  const [visitOpen, setVisitOpen] = useState(false)
  const [visitTeamUsers, setVisitTeamUsers] = useState<VisitTeamUser[]>([])
  const [visitTeamLoading, setVisitTeamLoading] = useState(false)
  const [visitTeamError, setVisitTeamError] = useState<string | null>(null)
  const [visitTeamUserId, setVisitTeamUserId] = useState('')
  const [visitScheduledAt, setVisitScheduledAt] = useState('')
  const [visitLocation, setVisitLocation] = useState('')
  const [visitFee, setVisitFee] = useState('0')
  const [visitProjectSqft, setVisitProjectSqft] = useState('')
  const [visitProjectStatus, setVisitProjectStatus] = useState('')
  const [visitAttachmentFile, setVisitAttachmentFile] = useState<File | null>(null)
  const [visitNotes, setVisitNotes] = useState('')
  const [visitReason, setVisitReason] = useState('')
  const [didClearVisitDefaultReason, setDidClearVisitDefaultReason] = useState(false)
  const [visitSaving, setVisitSaving] = useState(false)
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false)
  const [scheduledVisitCard, setScheduledVisitCard] = useState<ScheduledVisitCard | null>(null)
  const [leadVisits, setLeadVisits] = useState<LeadVisitRecord[]>([])
  const [leadVisitsLoading, setLeadVisitsLoading] = useState(false)
  const [resolvingVisitRequestId, setResolvingVisitRequestId] = useState<string | null>(null)
  const [resolveRequestOpen, setResolveRequestOpen] = useState(false)
  const [resolveVisitId, setResolveVisitId] = useState('')
  const [resolveRequestId, setResolveRequestId] = useState('')
  const [resolveRequestType, setResolveRequestType] = useState<'RESCHEDULE' | 'CANCEL' | ''>('')
  const [resolveScheduledAt, setResolveScheduledAt] = useState('')
  const [resolveReason, setResolveReason] = useState('')
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [visitResultOpen, setVisitResultOpen] = useState(false)
  const [visitResultVisitId, setVisitResultVisitId] = useState('')
  const [visitResultSummary, setVisitResultSummary] = useState('')
  const [visitResultClientMood, setVisitResultClientMood] = useState('')
  const [visitResultProjectStatus, setVisitResultProjectStatus] = useState('')
  const [visitResultClientPotentiality, setVisitResultClientPotentiality] = useState('')
  const [visitResultProjectType, setVisitResultProjectType] = useState('')
  const [visitResultClientPersonality, setVisitResultClientPersonality] = useState('')
  const [visitResultBudgetRange, setVisitResultBudgetRange] = useState('')
  const [visitResultTimelineUrgency, setVisitResultTimelineUrgency] = useState('')
  const [visitResultStylePreference, setVisitResultStylePreference] = useState('')
  const [visitResultSupportClientName, setVisitResultSupportClientName] = useState('')
  const [visitResultSupportProjectArea, setVisitResultSupportProjectArea] = useState('')
  const [visitResultSupportProjectStatus, setVisitResultSupportProjectStatus] = useState('')
  const [visitResultSupportExtraConcern, setVisitResultSupportExtraConcern] = useState('')
  const [visitResultRole, setVisitResultRole] = useState<VisitResultRole>('NONE')
  const [visitResultNote, setVisitResultNote] = useState('')
  const [visitResultFiles, setVisitResultFiles] = useState<File[]>([])
  const [visitResultError, setVisitResultError] = useState<string | null>(null)
  const [submittingVisitResult, setSubmittingVisitResult] = useState(false)
  const [loadingVisitResultData, setLoadingVisitResultData] = useState(false)
  const [isVisitResultUpdate, setIsVisitResultUpdate] = useState(false)
  const [localVisitStageLock, setLocalVisitStageLock] = useState(false)
  const [supportDialogOpen, setSupportDialogOpen] = useState(false)
  const [supportDialogVisitId, setSupportDialogVisitId] = useState('')
  const [availableSupportMembers, setAvailableSupportMembers] = useState<VisitSupportMemberOption[]>([])
  const [supportMemberSelection, setSupportMemberSelection] = useState('')
  const [supportDialogError, setSupportDialogError] = useState<string | null>(null)
  const [loadingSupportMembers, setLoadingSupportMembers] = useState(false)
  const [savingSupportMember, setSavingSupportMember] = useState(false)
  const locationTouchedRef = useRef(false)
  const locationPrefilledRef = useRef(false)

  const stageSubStatusMap: Record<string, string[]> = useMemo(
    () => ({
      NEW: [],
      NUMBER_COLLECTED: [],
      DISCOVERY: ['FIRST_MEETING_SET', 'PROPOSAL_SENT', 'LAYOUT_REVISION', 'PROJECT_DROPPED'],
      CAD_PHASE: ['CAD_ASSIGNED', 'CAD_WORKING', 'CAD_COMPLETED', 'CAD_APPROVED'],
      QUOTATION_PHASE: [
        'QUOTATION_ASSIGNED',
        'QUOTATION_WORKING',
        'QUOTATION_COMPLETED',
        'QUOTATION_CORRECTION',
      ],
      BUDGET_PHASE: [
        'BUDGET_MEETING_SET',
        'PROPOSAL_SENT',
        'REJECTED_OFFER',
      ],
      CONVERSION: ['CLIENT_CONFIRMED', 'CLIENT_PARTIALLY_PAID', 'CLIENT_FULL_PAID'],
      VISUALIZATION_PHASE: [
        'VISUAL_ASSIGNED',
        'VISUAL_WORKING',
        'VISUAL_COMPLETED',
        'CLIENT_APPROVED',
        'VISUAL_CORRECTION',
      ],
      VISIT_PHASE: ['VISIT_SCHEDULED', 'VISIT_COMPLETED', 'VISIT_RESCHEDULED', 'VISIT_CANCELLED'],
      CONTACT_ATTEMPTED: ['NO_ANSWER'],
      NURTURING: ['WARM_LEAD', 'FUTURE_CLIENT'],
      CLOSED: ['PROJECT_DROPPED', 'REJECTED_OFFER', 'SMALL_BUDGET', 'INVALID', 'NOT_INTERESTED', 'LOST', 'DEAD_LEAD'],
    }),
    [],
  )

  const subStatusOptions = stageSubStatusMap[stage] ?? []
  const jrCrmEnabledStages = useMemo(
    () => new Set(['NEW', 'NUMBER_COLLECTED', 'CONTACT_ATTEMPTED', 'NURTURING', 'VISIT_PHASE']),
    [],
  )
  const isJrCrmStageAllowed = !restrictStagesForJrCrm || jrCrmEnabledStages.has(stage)
  const isJrCrmVisitSubStatusAllowed =
    !restrictStagesForJrCrm ||
    stage !== 'VISIT_PHASE' ||
    subStatus === null ||
    subStatus === '' ||
    subStatus === 'VISIT_SCHEDULED'
  const requiresSubStatus = subStatusOptions.length > 0
  const stageOrder: Record<string, number> = {
    NEW: 0,
    NUMBER_COLLECTED: 1,
    CONTACT_ATTEMPTED: 2,
    NURTURING: 3,
    VISIT_PHASE: 4,
    CAD_PHASE: 5,
    DISCOVERY: 6,
    QUOTATION_PHASE: 7,
    BUDGET_PHASE: 8,
    CONVERSION: 9,
    VISUALIZATION_PHASE: 10,
    CLOSED: 11,
  }
  const originalStageRank = stageOrder[originalStage] ?? -1
  const selectedStageRank = stageOrder[stage] ?? -1
  const isForwardMove = selectedStageRank > originalStageRank
  const stageLockedAfterVisitScheduled =
    restrictStagesForJrCrm &&
    (originalStageRank >= stageOrder.VISIT_PHASE || localVisitStageLock)
  const hasStageChanged = stage !== originalStage || (subStatus ?? null) !== (originalSubStatus ?? null)
  const requiresPhoneForNumberCollected =
    stage === 'NUMBER_COLLECTED' &&
    isForwardMove &&
    originalStageRank < stageOrder.NUMBER_COLLECTED
  const isNoAnswerSubStatus =
    stage === 'CONTACT_ATTEMPTED' &&
    subStatus === 'NO_ANSWER'
  const shouldCreateFollowupForNoAnswer =
    isNoAnswerSubStatus
  const requiresPendingFollowupForNurturing =
    stage === 'NURTURING'
  const requiresFollowupForStageUpdate =
    shouldCreateFollowupForNoAnswer || requiresPendingFollowupForNurturing
  const showFollowupFieldsInStageModal =
    isNoAnswerSubStatus || requiresPendingFollowupForNurturing
  const requiresVisitSchedulingInStageModal = stage === 'VISIT_PHASE' && subStatus === 'VISIT_SCHEDULED'
  const canUpdateStage =
    (!requiresSubStatus || Boolean(subStatus)) &&
    hasStageChanged &&
    !stageLockedAfterVisitScheduled &&
    isJrCrmStageAllowed &&
    isJrCrmVisitSubStatusAllowed


  const getVisitStatusLabel = (value: string) => {
    if (value === 'SCHEDULED') return 'PENDING'
    return value
  }

  useEffect(() => {
    const latestOriginalStageRank = stageOrder[originalStage] ?? -1
    if (latestOriginalStageRank < stageOrder.VISIT_PHASE) {
      setLocalVisitStageLock(false)
    }
  }, [originalStage])

  const validDepartments = [
    'ADMIN',
    'SR_CRM',
    'JR_CRM',
    'QUOTATION',
    'VISIT_TEAM',
    'JR_ARCHITECT',
    'VISUALIZER_3D',
    'ACCOUNTS',
  ]

  const formatLabel = (value: string) => {
    if (value === 'DISCOVERY') return 'CONSULTING PHASE'
    if (value === 'PROPOSAL_SENT') return 'QUOTATION SENT'
    return value.replace(/_/g, ' ')
  }
  const defaultReasonByStage: Record<string, string> = {
    NEW: 'Lead has been moved to new.',
    NUMBER_COLLECTED: 'Number has been collected.',
    DISCOVERY: 'Consulting phase workflow has started.',
    CAD_PHASE: 'Lead has moved to CAD phase.',
    QUOTATION_PHASE: 'Lead has moved to quotation phase.',
    BUDGET_PHASE: 'Lead has moved to budget phase.',
    VISUALIZATION_PHASE: 'Lead has moved to visualization phase.',
    CONVERSION: 'Lead has moved to conversion phase.',
    VISIT_PHASE: 'Lead has moved to visit phase.',
    CONTACT_ATTEMPTED: 'Contact has been attempted.',
    NURTURING: 'Lead has been moved to nurturing for follow-up.',
    CLOSED: 'Lead has been closed.',
  }
  const defaultStageReason =
    defaultReasonByStage[stage] ?? 'Stage has been updated.'
  const defaultVisitReason = 'Visit has been scheduled.'

  const normalizedPhone = leadPhone ? leadPhone.replace(/\D/g, '') : ''
  const canWhatsapp = Boolean(normalizedPhone)
  const canEmail = Boolean(leadEmail && leadEmail.trim())
  const whatsappUrl = canWhatsapp ? `https://wa.me/${normalizedPhone}` : ''
  const emailUrl = canEmail ? `mailto:${leadEmail}` : ''

  const handleSendWhatsapp = useCallback(async () => {
    if (!normalizedPhone) {
      toast.error('No phone number found for this lead.')
      return
    }

    setSendingWhatsapp(true)
    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          phone: normalizedPhone,
          message: 'Hello! Thank you for connecting with Aesthetic CRM. How can we help you today?',
        }),
      })

      const payload = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Failed to send WhatsApp message')
      }

      toast.success('WhatsApp message sent successfully.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send WhatsApp message'
      toast.error(message)

      // Useful fallback so the team can still contact the lead immediately.
      if (whatsappUrl) {
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
      }
    } finally {
      setSendingWhatsapp(false)
    }
  }, [leadId, normalizedPhone, whatsappUrl])
  const shouldLoadVisitMetadata = visitOpen || (reasonOpen && requiresVisitSchedulingInStageModal)
  useEffect(() => {
    if (openScheduleOnMount) {
      setVisitOpen(true)
    }
  }, [openScheduleOnMount])
  useEffect(() => {
    if (!shouldLoadVisitMetadata) {
      locationTouchedRef.current = false
      locationPrefilledRef.current = false
      return
    }

    if (!locationPrefilledRef.current && leadLocation) {
      setVisitLocation(leadLocation)
      locationPrefilledRef.current = true
    }

    setVisitTeamLoading(true)
    setVisitTeamError(null)

    fetch(`/api/lead/${leadId}/visit-schedule`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data?.visitTeamMembers)) {
          setVisitTeamUsers(data.data.visitTeamMembers)
          if (!locationTouchedRef.current && !locationPrefilledRef.current && data.data?.defaultLocation) {
            setVisitLocation(data.data.defaultLocation)
            locationPrefilledRef.current = true
          }
          return
        }
        throw new Error(data.error || 'Failed to load visit schedule metadata.')
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Failed to load visit schedule metadata.'
        setVisitTeamError(message)
      })
      .finally(() => {
        setVisitTeamLoading(false)
      })
  }, [leadId, leadLocation, shouldLoadVisitMetadata, requiresVisitSchedulingInStageModal])

  const refreshLeadVisits = useCallback(() => {
    setLeadVisitsLoading(true)
    fetch(`/api/visit-schedule?leadId=${leadId}`)
      .then((res) => res.json())
      .then((payload) => {
        if (payload.success && Array.isArray(payload.data)) {
          const nextVisits = payload.data as LeadVisitRecord[]
          setLeadVisits(nextVisits)
          const latestVisit = nextVisits[0]
          if (latestVisit?.assignedTo) {
            setScheduledVisitCard({
              id: latestVisit.id,
              scheduledAt: latestVisit.scheduledAt,
              location: latestVisit.location,
              visitFee: latestVisit.visitFee ?? 0,
              projectSqft: latestVisit.projectSqft ?? null,
              projectStatus: latestVisit.projectStatus ?? null,
              notes: latestVisit.notes ?? null,
              assignedToName: latestVisit.assignedTo.fullName,
              assignedToEmail: latestVisit.assignedTo.email,
            })
          } else {
            setScheduledVisitCard(null)
          }
        } else {
          setLeadVisits([])
          setScheduledVisitCard(null)
        }
      })
      .catch(() => {
        setLeadVisits([])
        setScheduledVisitCard(null)
      })
      .finally(() => setLeadVisitsLoading(false))
  }, [leadId])

  useEffect(() => {
    refreshLeadVisits()
  }, [refreshLeadVisits])

  const getVisitResultRole = useCallback(
    (visit: LeadVisitRecord): VisitResultRole => {
      if (canOverrideVisitLeadRole) return 'LEAD'
      if (!currentUserId) return 'NONE'
      if (visit.assignedTo?.id === currentUserId) return 'LEAD'
      const isSupport = (visit.supportAssignments ?? []).some(
        (item) => item.supportUserId === currentUserId,
      )
      return isSupport ? 'SUPPORT' : 'NONE'
    },
    [canOverrideVisitLeadRole, currentUserId],
  )
  const getPrimarySupportAssignment = useCallback((visit: LeadVisitRecord) => {
    return (visit.supportAssignments ?? [])[0] ?? null
  }, [])
  const canSubmitSupportVisitResult = useCallback(
    (visit: LeadVisitRecord) => {
      if (!currentUserId) return false
      return getPrimarySupportAssignment(visit)?.supportUserId === currentUserId
    },
    [currentUserId, getPrimarySupportAssignment],
  )
  const hasPendingPrimarySupportResult = useCallback(
    (visit: LeadVisitRecord | null) => {
      if (!visit) return false
      const primarySupportAssignment = getPrimarySupportAssignment(visit)
      return Boolean(primarySupportAssignment && !primarySupportAssignment.result)
    },
    [getPrimarySupportAssignment],
  )

  const visitResultCandidates = useMemo(
    () =>
      leadVisits.filter(
        (visit) => {
          if (
            visit.status !== 'SCHEDULED' &&
            visit.status !== 'RESCHEDULED' &&
            visit.status !== 'COMPLETED'
          ) {
            return false
          }
          const role = getVisitResultRole(visit)
          if (role === 'LEAD') return true
          if (role === 'SUPPORT') {
            return canSubmitSupportVisitResult(visit)
          }
          return false
        },
      ),
    [leadVisits, getVisitResultRole, canSubmitSupportVisitResult],
  )

  const selectedSupportVisit = useMemo(
    () => leadVisits.find((visit) => visit.id === supportDialogVisitId) ?? null,
    [leadVisits, supportDialogVisitId],
  )
  const selectedVisitResult = useMemo(
    () => leadVisits.find((visit) => visit.id === visitResultVisitId) ?? null,
    [leadVisits, visitResultVisitId],
  )
  const latestVisit = leadVisits[0] ?? null
  const isLatestVisitResultPending = useMemo(() => {
    if (!latestVisit) return false
    if (latestVisit.status === 'CANCELLED') return false
    if (latestVisit.status === 'COMPLETED') {
      return !latestVisit.result
    }
    return latestVisit.status === 'SCHEDULED' || latestVisit.status === 'RESCHEDULED'
  }, [latestVisit])
  const scheduleVisitDisabledReason = isLatestVisitResultPending
    ? 'Schedule is locked until the latest visit result is submitted.'
    : null

  useEffect(() => {
    if (!selectedVisitResult) {
      setVisitResultRole('NONE')
      return
    }
    const nextRole = getVisitResultRole(selectedVisitResult)
    if (nextRole === 'SUPPORT' && !canSubmitSupportVisitResult(selectedVisitResult)) {
      setVisitResultRole('NONE')
      return
    }
    setVisitResultRole(nextRole)
  }, [selectedVisitResult, getVisitResultRole, canSubmitSupportVisitResult])

  const canManageSupportForVisit = useCallback(
    (visit: LeadVisitRecord) => {
      if (!currentUserId) return false
      return visit.assignedTo?.id === currentUserId
    },
    [currentUserId],
  )

  const openSupportDialog = useCallback(
    async (visit: LeadVisitRecord) => {
      setSupportDialogVisitId(visit.id)
      setSupportDialogOpen(true)
      setSupportDialogError(null)
      setSupportMemberSelection('')
      setLoadingSupportMembers(true)

      try {
        const response = await fetch(`/api/visit-schedule/${visit.id}/supports`)
        const payload = await response.json()
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Failed to load support members')
        }

        const members = Array.isArray(payload.data?.availableMembers)
          ? payload.data.availableMembers
          : []
        setAvailableSupportMembers(members)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load support members'
        setSupportDialogError(message)
        setAvailableSupportMembers([])
      } finally {
        setLoadingSupportMembers(false)
      }
    },
    [],
  )

  const handleAddSupportMember = async () => {
    if (!supportDialogVisitId || !supportMemberSelection) {
      setSupportDialogError('Please select a support member.')
      return
    }

    setSavingSupportMember(true)
    setSupportDialogError(null)
    try {
      const response = await fetch(`/api/visit-schedule/${supportDialogVisitId}/supports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supportUserId: supportMemberSelection }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to add support member')
      }

      toast.success('Support member added.')
      setSupportMemberSelection('')
      setSupportDialogOpen(false)
      setSupportDialogVisitId('')
      setAvailableSupportMembers([])
      refreshLeadVisits()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add support member'
      setSupportDialogError(message)
    } finally {
      setSavingSupportMember(false)
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
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to remove support member')
      }
      toast.success('Support member removed.')
      refreshLeadVisits()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove support member'
      toast.error(message)
    }
  }

  const resetVisitResultForm = useCallback(() => {
    setVisitResultVisitId('')
    setVisitResultRole('NONE')
    setVisitResultSummary('')
    setVisitResultClientMood('')
    setVisitResultProjectStatus('')
    setVisitResultClientPotentiality('')
    setVisitResultProjectType('')
    setVisitResultClientPersonality('')
    setVisitResultBudgetRange('')
    setVisitResultTimelineUrgency('')
    setVisitResultStylePreference('')
    setVisitResultSupportClientName('')
    setVisitResultSupportProjectArea('')
    setVisitResultSupportProjectStatus('')
    setVisitResultSupportExtraConcern('')
    setVisitResultNote('')
    setVisitResultFiles([])
    setVisitResultError(null)
    setLoadingVisitResultData(false)
    setIsVisitResultUpdate(false)
  }, [])

  const clearLeadVisitResultFields = useCallback(() => {
    setVisitResultSummary('')
    setVisitResultClientMood('')
    setVisitResultProjectStatus('')
    setVisitResultClientPotentiality('')
    setVisitResultProjectType('')
    setVisitResultClientPersonality('')
    setVisitResultBudgetRange('')
    setVisitResultTimelineUrgency('')
    setVisitResultStylePreference('')
    setVisitResultNote('')
    setVisitResultFiles([])
  }, [])

  const clearSupportVisitResultFields = useCallback(() => {
    setVisitResultSupportClientName('')
    setVisitResultSupportProjectArea('')
    setVisitResultSupportProjectStatus('')
    setVisitResultSupportExtraConcern('')
    setVisitResultFiles([])
  }, [])

  const handleRejectVisitRequest = async (visitId: string, requestId: string) => {
    setResolvingVisitRequestId(requestId)
    try {
      const res = await fetch(`/api/visit-schedule/${visitId}/update-request/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT' }),
      })
      const payload = await res.json()
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to resolve request')
      }
      refreshLeadVisits()
      onLeadRefresh?.()
      toast.success('Visit update request rejected.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resolve request'
      toast.error(message)
    } finally {
      setResolvingVisitRequestId(null)
    }
  }

  const openResolveRequestDialog = (
    visitId: string,
    requestId: string,
    requestType: 'RESCHEDULE' | 'CANCEL',
    requestedScheduleAt?: string | null,
  ) => {
    setResolveError(null)
    setResolveVisitId(visitId)
    setResolveRequestId(requestId)
    setResolveRequestType(requestType)
    setResolveReason('')
    if (requestType === 'RESCHEDULE') {
      if (requestedScheduleAt) {
        const d = new Date(requestedScheduleAt)
        if (!Number.isNaN(d.getTime())) {
          setResolveScheduledAt(formatDateToLocalHourInput(d))
        } else {
          setResolveScheduledAt('')
        }
      } else {
        setResolveScheduledAt('')
      }
    } else {
      setResolveScheduledAt('')
    }
    setResolveRequestOpen(true)
  }

  const handleApproveVisitRequest = async () => {
    if (!resolveVisitId || !resolveRequestId || !resolveRequestType) {
      setResolveError('Invalid request. Please try again.')
      return
    }
    if (resolveRequestType === 'RESCHEDULE' && !resolveScheduledAt) {
      setResolveError('Please provide reschedule date and time.')
      return
    }

    setResolvingVisitRequestId(resolveRequestId)
    setResolveError(null)
    try {
      const res = await fetch(
        `/api/visit-schedule/${resolveVisitId}/update-request/${resolveRequestId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'APPROVE',
            scheduledAt:
              resolveRequestType === 'RESCHEDULE' && resolveScheduledAt
                ? new Date(resolveScheduledAt).toISOString()
                : undefined,
            reason: resolveReason.trim() || undefined,
          }),
        },
      )
      const payload = await res.json()
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to resolve request')
      }

      setResolveRequestOpen(false)
      setResolveVisitId('')
      setResolveRequestId('')
      setResolveRequestType('')
      setResolveScheduledAt('')
      setResolveReason('')
      refreshLeadVisits()
      onLeadRefresh?.()
      toast.success('Visit update request approved.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resolve request'
      setResolveError(message)
      toast.error(message)
    } finally {
      setResolvingVisitRequestId(null)
    }
  }

  const handleStageChange = (value: string) => {
    if (restrictStagesForJrCrm && !jrCrmEnabledStages.has(value)) {
      setStageError('For JR CRM, only Number Collected, Contact Attempted, Nurturing, and Visit Phase are enabled.')
      return
    }
    if (value === 'VISIT_PHASE' && subStatus === 'VISIT_COMPLETED' && !canSetVisitCompletedStage) {
      setStageError('Visit Completed can only be set from visit result.')
      return
    }
    setStageError(null)
    onStageChange(value)
    const nextOptions = stageSubStatusMap[value] ?? []
    if (nextOptions.length === 0) {
      onSubStatusChange(null)
    } else {
      onSubStatusChange('')
    }
  }

  const openReasonDialog = () => {
    setStageError(null)
    if (stageLockedAfterVisitScheduled) {
      setStageError('After entering Visit Phase, CRM stage changes are locked.')
      return
    }
    if (!canUpdateStage) {
      setStageError('Select a substatus to continue.')
      return
    }
    if (stage === 'VISIT_PHASE' && subStatus === 'VISIT_COMPLETED') {
      if (!canSetVisitCompletedStage) {
        setStageError('Visit Completed can only be set from visit result.')
        return
      }
      if (!canSubmitVisitResult) {
        setStageError('Visit Completed must be submitted via visit result by the assigned visit lead or admin.')
        return
      }
      if (visitResultCandidates.length === 0) {
        setStageError('No eligible visit found to complete. Please schedule a visit first.')
        return
      }
      handleVisitResultOpenChange(true)
      return
    }
    if (requiresVisitSchedulingInStageModal && isLatestVisitResultPending) {
      setStageError(scheduleVisitDisabledReason)
      return
    }
    setStageFollowupDate('')
    setStageFollowupNotes('')
    setStagePhone(leadPhone ?? '')
    setReason(defaultStageReason)
    setDidClearDefaultReason(false)
    setReasonOpen(true)
  }

  const handleStageSubmit = async () => {
    if (stage === 'VISIT_PHASE' && subStatus === 'VISIT_COMPLETED') {
      setStageError('Use the Visit Result modal to complete Visit Phase.')
      return
    }
    const finalReason = reason.trim() || defaultStageReason
    if (requiresFollowupForStageUpdate && !stageFollowupDate) {
      setStageError('Please select a follow-up date.')
      return
    }
    if (requiresPhoneForNumberCollected) {
      const normalized = stagePhone.replace(/\D/g, '')
      if (normalized.length < 7) {
        setStageError('Phone number is required to move to Number Collected.')
        return
      }
    }
    if (requiresVisitSchedulingInStageModal) {
      if (!visitTeamUserId) {
        setStageError('Please select a visit team member.')
        return
      }
      if (!visitScheduledAt) {
        setStageError('Please choose a visit date and time.')
        return
      }
      if (!visitLocation.trim()) {
        setStageError('Please provide a visit location.')
        return
      }
      if (visitProjectSqft.trim() && Number(visitProjectSqft) <= 0) {
        setStageError('Project sqft must be greater than 0.')
        return
      }
      if (visitFee.trim() && Number(visitFee) < 0) {
        setStageError('Visit fee must be 0 or more.')
        return
      }
    }

    setSavingStage(true)
    setStageError(null)
    try {
      if (requiresPhoneForNumberCollected) {
        const phoneResponse = await fetch(`/api/lead/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: stagePhone.trim() }),
        })
        const phonePayload = await phoneResponse.json()
        if (!phoneResponse.ok || !phonePayload.success) {
          throw new Error(phonePayload.error || 'Failed to update phone number.')
        }
      }

      if (requiresVisitSchedulingInStageModal) {
        const scheduledIso = new Date(visitScheduledAt).toISOString()
        const response = await fetch(`/api/lead/${leadId}/visit-schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitTeamUserId,
            scheduledAt: scheduledIso,
            location: visitLocation.trim(),
            visitFee: visitFee.trim() ? Number(visitFee) : 0,
            projectSqft: visitProjectSqft.trim() ? Number(visitProjectSqft) : undefined,
            projectStatus: visitProjectStatus || undefined,
            notes: visitNotes.trim() || undefined,
            reason: finalReason,
          }),
        })

        const data = await response.json()
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to schedule visit.')
        }

        const assignedUser = visitTeamUsers.find((user) => user.id === visitTeamUserId)
        const createdVisit = data.data?.visit
        if (createdVisit && assignedUser) {
          setScheduledVisitCard({
            id: createdVisit.id,
            scheduledAt: createdVisit.scheduledAt,
            location: createdVisit.location,
            visitFee: createdVisit.visitFee ?? 0,
            projectSqft: createdVisit.projectSqft ?? null,
            projectStatus: createdVisit.projectStatus ?? null,
            notes: createdVisit.notes ?? null,
            assignedToName: assignedUser.fullName,
            assignedToEmail: assignedUser.email,
          })
        }

        if (visitAttachmentFile) {
          const formData = new FormData()
          formData.append('file', visitAttachmentFile)

          const attachmentRes = await fetch(`/api/lead/${leadId}/attachments`, {
            method: 'POST',
            body: formData,
          })
          const attachmentPayload = await attachmentRes.json()
          if (!attachmentRes.ok || !attachmentPayload.success) {
            toast.error(
              attachmentPayload.error || 'Visit scheduled, but failed to upload attachment.',
            )
          } else {
            onAttachmentRefresh?.()
          }
        }

        setReasonOpen(false)
        setReason('')
        setStageFollowupDate('')
        setStageFollowupNotes('')
        onStageChange('VISIT_PHASE')
        onSubStatusChange('VISIT_SCHEDULED')
        setLocalVisitStageLock(true)
        resetVisitForm()
        refreshLeadVisits()
        onFollowupRefresh?.()
        onLeadRefresh?.()
        return
      }

      await onUpdateStage(finalReason)
      if (requiresFollowupForStageUpdate) {
        if (!onCreateFollowupForStage) {
          throw new Error('Follow-up handler is not available.')
        }
        await onCreateFollowupForStage({
          followupDate: stageFollowupDate,
          notes: stageFollowupNotes.trim() || undefined,
        })
      }
      setReasonOpen(false)
      setReason('')
      setStageFollowupDate('')
      setStageFollowupNotes('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update stage.'
      setStageError(message)
    } finally {
      setSavingStage(false)
    }
  }

  const resetVisitForm = () => {
    setVisitTeamUserId('')
    setVisitScheduledAt('')
    setVisitLocation(leadLocation ?? '')
    setVisitFee('0')
    setVisitProjectSqft('')
    setVisitProjectStatus('')
    setVisitAttachmentFile(null)
    setVisitNotes('')
    setVisitReason(defaultVisitReason)
    setDidClearVisitDefaultReason(false)
    setVisitTeamError(null)
    locationTouchedRef.current = false
    locationPrefilledRef.current = Boolean(leadLocation)
  }

  const handleVisitOpenChange = (open: boolean) => {
    setVisitOpen(open)
    if (!open) {
      resetVisitForm()
    } else if (!visitReason) {
      setVisitReason(defaultVisitReason)
      setDidClearVisitDefaultReason(false)
    }
  }

  const handleScheduleVisit = async () => {
    if (isLatestVisitResultPending) {
      setVisitTeamError(scheduleVisitDisabledReason)
      return
    }
    if (!visitTeamUserId) {
      setVisitTeamError('Please select a visit team member.')
      return
    }

    if (!visitScheduledAt) {
      setVisitTeamError('Please choose a visit date and time.')
      return
    }

    if (!visitLocation.trim()) {
      setVisitTeamError('Please provide a visit location.')
      return
    }
    if (visitProjectSqft.trim() && Number(visitProjectSqft) <= 0) {
      setVisitTeamError('Project sqft must be greater than 0.')
      return
    }
    if (visitFee.trim() && Number(visitFee) < 0) {
      setVisitTeamError('Visit fee must be 0 or more.')
      return
    }

    const scheduledIso = new Date(visitScheduledAt).toISOString()

    setVisitSaving(true)
    setVisitTeamError(null)

    const schedulePromise = async () => {
      const response = await fetch(`/api/lead/${leadId}/visit-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitTeamUserId,
          scheduledAt: scheduledIso,
          location: visitLocation.trim(),
          visitFee: visitFee.trim() ? Number(visitFee) : 0,
          projectSqft: visitProjectSqft.trim() ? Number(visitProjectSqft) : undefined,
          projectStatus: visitProjectStatus || undefined,
          notes: visitNotes.trim() || undefined,
          reason: visitReason.trim() || undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to schedule visit.')
      }

      const assignedUser = visitTeamUsers.find((user) => user.id === visitTeamUserId)
      const createdVisit = data.data?.visit
      return { assignedUser, createdVisit }
    }

    try {
      const scheduleRequest = schedulePromise()
      await toast.promise(scheduleRequest, {
        loading: 'Scheduling visit...',
        success: 'Visit scheduled successfully.',
        error: (err) =>
          err instanceof Error ? err.message : 'Failed to schedule visit.',
      })
      const { assignedUser, createdVisit } = await scheduleRequest

      if (createdVisit && assignedUser) {
        setScheduledVisitCard({
          id: createdVisit.id,
          scheduledAt: createdVisit.scheduledAt,
          location: createdVisit.location,
          visitFee: createdVisit.visitFee ?? 0,
          projectSqft: createdVisit.projectSqft ?? null,
          projectStatus: createdVisit.projectStatus ?? null,
          notes: createdVisit.notes ?? null,
          assignedToName: assignedUser.fullName,
          assignedToEmail: assignedUser.email,
        })
      }

      if (visitAttachmentFile) {
        const formData = new FormData()
        formData.append('file', visitAttachmentFile)

        const attachmentRes = await fetch(`/api/lead/${leadId}/attachments`, {
          method: 'POST',
          body: formData,
        })
        const attachmentPayload = await attachmentRes.json()
        if (!attachmentRes.ok || !attachmentPayload.success) {
          toast.error(
            attachmentPayload.error || 'Visit scheduled, but failed to upload attachment.',
          )
        } else {
          onAttachmentRefresh?.()
        }
      }

      setVisitOpen(false)
      resetVisitForm()
      onStageChange('VISIT_PHASE')
      onSubStatusChange('VISIT_SCHEDULED')
      setLocalVisitStageLock(true)
      refreshLeadVisits()
      onFollowupRefresh?.()
      onLeadRefresh?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to schedule visit.'
      setVisitTeamError(message)
    } finally {
      setVisitSaving(false)
    }
  }

  const handleVisitResultOpenChange = (open: boolean) => {
    setVisitResultOpen(open)
    if (!open) {
      resetVisitResultForm()
    } else if (visitResultCandidates.length > 0) {
      setVisitResultVisitId((prev) => prev || visitResultCandidates[0].id)
    }
  }

  useEffect(() => {
    if (!visitResultOpen || !visitResultVisitId || visitResultRole === 'NONE') return

    let cancelled = false
    setVisitResultError(null)
    setLoadingVisitResultData(true)
    setIsVisitResultUpdate(false)

    if (visitResultRole === 'SUPPORT') {
      clearSupportVisitResultFields()
    } else {
      clearLeadVisitResultFields()
    }

    const loadVisitResultData = async () => {
      try {
        const response = await fetch(`/api/visit-schedule/${visitResultVisitId}/result`)
        const payload = await response.json()

        if (!response.ok || !payload.success) {
          if (response.status === 404) return
          throw new Error(payload.error || 'Failed to load existing visit result.')
        }
        if (cancelled) return

        if (visitResultRole === 'SUPPORT') {
          const supportResults = Array.isArray(payload.data?.supportResults)
            ? payload.data.supportResults
            : []
          const existingSupportResult = supportResults.find(
            (item: { supportUser?: { id?: string | null } | null }) =>
              item.supportUser?.id === currentUserId,
          )

          setIsVisitResultUpdate(Boolean(existingSupportResult))
          setVisitResultSupportClientName(existingSupportResult?.clientName ?? '')
          setVisitResultSupportProjectArea(existingSupportResult?.projectArea ?? '')
          setVisitResultSupportProjectStatus(existingSupportResult?.projectStatus ?? '')
          setVisitResultSupportExtraConcern(existingSupportResult?.extraConcern ?? '')
          return
        }

        const leadResult = payload.data?.leadResult ?? null
        setIsVisitResultUpdate(Boolean(leadResult))
        setVisitResultSummary(leadResult?.summary ?? '')
        setVisitResultClientMood(leadResult?.clientMood ?? '')
        setVisitResultClientPotentiality(leadResult?.clientPotentiality ?? '')
        setVisitResultProjectType(leadResult?.projectType ?? '')
        setVisitResultClientPersonality(leadResult?.clientPersonality ?? '')
        setVisitResultBudgetRange(leadResult?.budgetRange ?? '')
        setVisitResultTimelineUrgency(leadResult?.timelineUrgency ?? '')
        setVisitResultStylePreference(leadResult?.stylePreference ?? '')
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Failed to load existing visit result.'
        setVisitResultError(message)
      } finally {
        if (!cancelled) {
          setLoadingVisitResultData(false)
        }
      }
    }

    void loadVisitResultData()

    return () => {
      cancelled = true
    }
  }, [
    visitResultOpen,
    visitResultVisitId,
    visitResultRole,
    currentUserId,
    clearLeadVisitResultFields,
    clearSupportVisitResultFields,
  ])

  const handleSubmitVisitResult = async () => {
    if (!visitResultVisitId) {
      setVisitResultError('Please select a visit.')
      return
    }
    if (visitResultRole === 'NONE') {
      setVisitResultError('You can only submit data for visits assigned to you.')
      return
    }
    const hasPendingPrimarySupport =
      visitResultRole === 'LEAD' ? hasPendingPrimarySupportResult(selectedVisitResult) : false
    if (hasPendingPrimarySupport) {
      setVisitResultError('Visit cannot be completed until the first support member submits support data.')
      return
    }
    if (
      visitResultRole === 'SUPPORT' &&
      selectedVisitResult &&
      !canSubmitSupportVisitResult(selectedVisitResult)
    ) {
      setVisitResultError('Only the first assigned support member can submit support data for this visit.')
      return
    }
    if (visitResultRole === 'LEAD' && !visitResultSummary.trim()) {
      setVisitResultError('Please add a visit summary.')
      return
    }
    if (visitResultRole === 'SUPPORT') {
      if (
        !visitResultSupportClientName.trim() ||
        !visitResultSupportProjectArea.trim() ||
        !visitResultSupportProjectStatus.trim()
      ) {
        setVisitResultError('Client Name, Project Area, and Project Status are required for support.')
        return
      }
    }

    setSubmittingVisitResult(true)
    setVisitResultError(null)
    try {
      const formData = new FormData()
      formData.append('resultType', visitResultRole)
      if (visitResultRole === 'LEAD') {
        formData.append('summary', visitResultSummary.trim())
        if (visitResultClientMood.trim()) {
          formData.append('clientMood', visitResultClientMood.trim())
        }
        if (visitResultProjectStatus) {
          formData.append('projectStatus', visitResultProjectStatus)
        }
        if (visitResultClientPotentiality) {
          formData.append('clientPotentiality', visitResultClientPotentiality)
        }
        if (visitResultProjectType) {
          formData.append('projectType', visitResultProjectType)
        }
        if (visitResultClientPersonality) {
          formData.append('clientPersonality', visitResultClientPersonality)
        }
        if (visitResultBudgetRange.trim()) {
          formData.append('budgetRange', visitResultBudgetRange.trim())
        }
        if (visitResultTimelineUrgency) {
          formData.append('timelineUrgency', visitResultTimelineUrgency)
        }
        if (visitResultStylePreference) {
          formData.append('stylePreference', visitResultStylePreference)
        }
        if (visitResultNote.trim()) {
          formData.append('note', visitResultNote.trim())
        }
      } else {
        formData.append('supportClientName', visitResultSupportClientName.trim())
        formData.append('supportProjectArea', visitResultSupportProjectArea.trim())
        formData.append('supportProjectStatus', visitResultSupportProjectStatus.trim())
        if (visitResultSupportExtraConcern.trim()) {
          formData.append('supportExtraConcern', visitResultSupportExtraConcern.trim())
        }
      }
      visitResultFiles.forEach((file) => {
        formData.append('files', file)
      })

      const response = await fetch(`/api/visit-schedule/${visitResultVisitId}/result`, {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to submit visit result.')
      }

      toast.success(
        visitResultRole === 'SUPPORT'
          ? isVisitResultUpdate
            ? 'Support visit data updated.'
            : 'Support visit data submitted.'
          : isVisitResultUpdate
            ? 'Visit result updated.'
            : 'Visit result submitted and lead moved to Visit Completed.',
      )
      setVisitResultOpen(false)
      resetVisitResultForm()
      if (visitResultRole === 'LEAD' && !isVisitResultUpdate) {
        onStageChange('VISIT_PHASE')
        onSubStatusChange('VISIT_COMPLETED')
      }
      onLeadRefresh?.()
      refreshLeadVisits()
      onFollowupRefresh?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit visit result.'
      setVisitResultError(message)
    } finally {
      setSubmittingVisitResult(false)
    }
  }

  const handleDepartmentChange = async (value: string, preselectedUserId?: string) => {
    setDepartment(value)
    setSelectedUserId('')
    setAssignError(null)
    setDepartmentUsers([])

    if (!value) return

    setUsersLoading(true)
    try {
      const response = await fetch(`/api/department/available/${value}`)
      const data = await response.json()
      // console.log('[LEAD-ACTIONS] Department API response:', data);
      if (data.success && Array.isArray(data.users)) {
        setDepartmentUsers(data.users)
        if (preselectedUserId) {
          setSelectedUserId(preselectedUserId)
        }
        // console.log('[LEAD-ACTIONS] Set users:', data.users);
      } else {
        throw new Error(data.error || 'Failed to load users for department.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load users.'
      setAssignError(message)
      console.error('[LEAD-ACTIONS] Error loading users:', error);
    } finally {
      setUsersLoading(false)
    }
  }

  const handleAssign = async () => {
    if (!department) {
      setAssignError('Please select a department.')
      return
    }

    if (!selectedUserId) {
      setAssignError('Please select a user.')
      return
    }

    setAssigning(true)
    setAssignError(null)

    try {
      const response = await fetch(`/api/lead/${leadId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          department,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save assignment.')
      }

      setAssignOpen(false)
      setDepartment('')
      setSelectedUserId('')
      setDepartmentUsers([])
      onAssignmentsRefresh()
      if (department === 'VISIT_TEAM') {
        refreshLeadVisits()
        onLeadRefresh?.()
      }
      onFollowupRefresh?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save assignment.'
      setAssignError(message)
    } finally {
      setAssigning(false)
    }
  }

  const openAssignmentEditor = (assignment: Assignment) => {
    setAssignOpen(true)
    setAssignError(null)
    setDepartment(assignment.department)
    void handleDepartmentChange(assignment.department, assignment.user.id)
  }

  return (
    <div className="space-y-4">
      {/* Department Assignments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />
            Department Assignments
          </CardTitle>
          {canManageAssignments ? (
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="Add assignment">
                  <Plus className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add assignment</DialogTitle>
                  <DialogDescription>
                    Select a department and assign a user for this lead.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={department} onValueChange={handleDepartmentChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {validDepartments.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>User</Label>
                    <Select
                      value={selectedUserId}
                      onValueChange={setSelectedUserId}
                      disabled={!department || usersLoading || departmentUsers.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            usersLoading
                              ? 'Loading users...'
                              : department
                                ? 'Select user'
                                : 'Select department first'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {departmentUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.fullName} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {assignError ? (
                    <p className="text-sm text-destructive">{assignError}</p>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleAssign}
                    disabled={assigning || !department || !selectedUserId}
                  >
                    {assigning ? 'Saving...' : 'Save assignment'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </CardHeader>
        <CardContent>
          {assignmentsLoading ? (
            <div className="text-center text-muted-foreground text-sm py-4">
              <div className="inline-block w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="mt-2">Loading assignments...</p>
            </div>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assignments yet</p>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="p-3 bg-secondary/50 rounded-lg border border-border">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{assignment.department}</p>
                      <p className="font-semibold text-foreground mt-1 text-sm">{assignment.user.fullName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{assignment.user.email}</p>
                    </div>
                    {canManageAssignments ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => openAssignmentEditor(assignment)}
                      >
                        Change
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Stage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Change Stage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={stage} onValueChange={handleStageChange} disabled={!canManageStage || stageLockedAfterVisitScheduled}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NEW" disabled={restrictStagesForJrCrm && !jrCrmEnabledStages.has('NEW')}>New</SelectItem>
              <SelectItem value="NUMBER_COLLECTED">
                Number Collected
              </SelectItem>
              <SelectItem value="CONTACT_ATTEMPTED">
                Contact Attempted
              </SelectItem>
              <SelectItem value="NURTURING">
                Nurturing
              </SelectItem>
              <SelectItem value="VISIT_PHASE">Visit Phase</SelectItem>
              <SelectItem value="CAD_PHASE" disabled={restrictStagesForJrCrm}>CAD Phase</SelectItem>
              <SelectItem value="DISCOVERY" disabled={restrictStagesForJrCrm}>Consulting Phase</SelectItem>
              <SelectItem value="QUOTATION_PHASE" disabled={restrictStagesForJrCrm}>Quotation Phase</SelectItem>
              <SelectItem value="BUDGET_PHASE" disabled={restrictStagesForJrCrm}>Budget Phase</SelectItem>
              <SelectItem value="CONVERSION" disabled={restrictStagesForJrCrm}>Conversion</SelectItem>
              <SelectItem value="VISUALIZATION_PHASE" disabled={restrictStagesForJrCrm}>Visualization Phase</SelectItem>
              <SelectItem value="CLOSED" disabled={restrictStagesForJrCrm}>
                Closed
              </SelectItem>
            </SelectContent>
          </Select>

          {requiresSubStatus ? (
            <Select
              value={subStatus ?? ''}
              onValueChange={(value) => {
                if (restrictStagesForJrCrm && stage === 'VISIT_PHASE' && value !== 'VISIT_SCHEDULED') {
                  setStageError('For JR CRM, only Visit Scheduled is enabled in Visit Phase.')
                  return
                }
                setStageError(null)
                onSubStatusChange(value)
              }}
              disabled={!canManageStage}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select substatus" />
              </SelectTrigger>
              <SelectContent>
                {subStatusOptions.map((option) => (
                  <SelectItem
                    key={option}
                    value={option}
                    disabled={restrictStagesForJrCrm && stage === 'VISIT_PHASE' && option !== 'VISIT_SCHEDULED'}
                  >
                    {formatLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-xs text-muted-foreground">
              No substatus required for this stage.
            </p>
          )}

          {stageError ? <p className="text-xs text-destructive">{stageError}</p> : null}
          {!canManageStage ? (
            <p className="text-xs text-muted-foreground">
              Stage updates are managed by JR CRM/Admin.
            </p>
          ) : null}
          {canManageStage && stageLockedAfterVisitScheduled ? (
            <p className="text-xs text-muted-foreground">
              Once the lead reaches Visit Phase, CRM stage updates are locked.
            </p>
          ) : null}

          <Dialog
            open={reasonOpen}
            onOpenChange={(open) => {
              setReasonOpen(open)
              if (!open) {
                setReason('')
                setDidClearDefaultReason(false)
                setStageFollowupDate('')
                setStageFollowupNotes('')
                setStageError(null)
              }
            }}
          >
            <Button
              className="w-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
              onClick={openReasonDialog}
              disabled={!canUpdateStage || !canManageStage}
            >
              Update Stage
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reason for change</DialogTitle>
                <DialogDescription>
                  {requiresVisitSchedulingInStageModal
                    ? 'Add reason and visit details. Submitting will schedule the visit and move stage to Visit Phase.'
                    : showFollowupFieldsInStageModal
                    ? 'Add a reason and schedule the required follow-up.'
                    : 'Add a short reason for updating the stage/substatus.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {requiresPhoneForNumberCollected ? (
                  <div className="space-y-2 rounded-md border border-border bg-secondary/30 p-3">
                    <Label>Phone number</Label>
                    <Input
                      type="tel"
                      value={stagePhone}
                      onChange={(event) => setStagePhone(event.target.value)}
                      placeholder="Enter lead phone number"
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    onPointerDown={() => {
                      if (!didClearDefaultReason && reason === defaultStageReason) {
                        setReason('')
                        setDidClearDefaultReason(true)
                      }
                    }}
                    placeholder="Type the reason for this change..."
                    rows={4}
                  />
                </div>
                {requiresVisitSchedulingInStageModal ? (
                  <div className="space-y-4 rounded-md border border-border bg-secondary/30 p-3">
                    <div className="space-y-2">
                      <Label>Visit team member</Label>
                      <Select
                        value={visitTeamUserId}
                        onValueChange={setVisitTeamUserId}
                        disabled={visitTeamLoading || visitTeamUsers.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              visitTeamLoading
                                ? 'Loading team...'
                                : visitTeamUsers.length === 0
                                  ? 'No visit team members'
                                  : 'Select member'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {visitTeamUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName} ({user.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Scheduled date & time</Label>
                      <Input
                        type="datetime-local"
                        value={visitScheduledAt}
                        step={3600}
                        className={dateTimeInputClassName}
                        onChange={(event) => setVisitScheduledAt(toHourPrecisionLocalDateTime(event.target.value))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Lead / Visit Location</Label>
                      <Input
                        value={visitLocation}
                        onChange={(event) => {
                          locationTouchedRef.current = true
                          setVisitLocation(event.target.value)
                        }}
                        placeholder="Location (will update lead location)"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Visit Fee (Tk)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={visitFee}
                        onChange={(event) => setVisitFee(event.target.value)}
                        placeholder="0"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Project Sqft (optional)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={visitProjectSqft}
                        onChange={(event) => setVisitProjectSqft(event.target.value)}
                        placeholder="Enter project sqft"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Project Status (optional)</Label>
                      <Select value={visitProjectStatus} onValueChange={setVisitProjectStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UNDER_CONSTRUCTION">Under Construction</SelectItem>
                          <SelectItem value="READY">Ready</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Attachment (optional)</Label>
                      <Input
                        type="file"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null
                          setVisitAttachmentFile(file)
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={visitNotes}
                        onChange={(event) => setVisitNotes(event.target.value)}
                        placeholder="Optional notes"
                        rows={3}
                      />
                    </div>
                  </div>
                ) : null}
                {showFollowupFieldsInStageModal ? (
                  <div className="space-y-4 rounded-md border border-border bg-secondary/30 p-3">
                    {hasPendingFollowup ? (
                      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Existing pending follow-up will be completed automatically before this new follow-up is created.
                      </div>
                    ) : null}
                    {stage === 'NURTURING' ? (
                      <div className="space-y-2 rounded-md border border-red-300 bg-red-50 px-3 py-2">
                        <p className="text-xs text-red-700">
                          Nurturing stage change requires creating a new follow-up.
                        </p>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={onAddFollowup}
                        >
                          Add New Follow-up
                        </Button>
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label>Follow-up date</Label>
                      <Input
                        type="datetime-local"
                        value={stageFollowupDate}
                        onChange={(event) => setStageFollowupDate(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Follow-up notes</Label>
                      <Textarea
                        value={stageFollowupNotes}
                        onChange={(event) => setStageFollowupNotes(event.target.value)}
                        placeholder="Optional follow-up notes..."
                        rows={3}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              {stageError ? <p className="text-xs text-destructive">{stageError}</p> : null}
              <DialogFooter>
                <Button onClick={handleStageSubmit} disabled={savingStage}>
                  {savingStage ? 'Saving...' : 'Confirm update'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {leadVisitsLoading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Loading visit schedule...
          </CardContent>
        </Card>
      ) : leadVisits.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visit Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {leadVisits.map((visit) => (
              <div key={visit.id} className="rounded-lg border border-border bg-secondary/40 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-foreground">
                    {visit.assignedTo?.fullName ?? 'Unassigned'}
                  </div>
                  <span className="text-xs text-muted-foreground">{getVisitStatusLabel(visit.status)}</span>
                </div>
                <div className="text-muted-foreground">
                  {new Date(visit.scheduledAt).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </div>
                <div className="text-muted-foreground">{visit.location}</div>
                <div className="text-muted-foreground">Visit Fee: Tk {visit.visitFee ?? 0}</div>
                {visit.projectSqft ? (
                  <div className="text-muted-foreground">Sqft: {visit.projectSqft}</div>
                ) : null}
                {visit.projectStatus ? (
                  <div className="text-muted-foreground">
                    Project Status: {formatLabel(visit.projectStatus)}
                  </div>
                ) : null}
                {visit.notes ? (
                  <p className="text-muted-foreground">{visit.notes}</p>
                ) : null}
                <div className="mt-2 rounded-md border border-border bg-background/70 p-2">
                  <p className="text-xs font-semibold text-foreground">Support Members</p>
                  {(visit.supportAssignments ?? []).length > 0 ? (
                    <div className="mt-1 space-y-1">
                      {(visit.supportAssignments ?? []).map((supportItem) => (
                        <div key={supportItem.id} className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">{supportItem.supportUser.fullName}</p>
                          <div className="flex items-center gap-1">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                supportItem.result
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {supportItem.result ? 'Submitted' : 'Pending'}
                            </span>
                            {canManageSupportForVisit(visit) ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => void handleRemoveSupportMember(visit.id, supportItem.supportUserId)}
                              >
                                Remove
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">No support members assigned yet.</p>
                  )}
                  {canManageSupportForVisit(visit) ? (
                    <div className="pt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => void openSupportDialog(visit)}
                      >
                        Manage Support Members
                      </Button>
                    </div>
                  ) : null}
                </div>
                {(visit.updateRequests ?? []).length > 0 ? (
                  <div className="mt-2 space-y-2 rounded-md border border-amber-200 bg-amber-50/70 p-2">
                    {(visit.updateRequests ?? []).map((requestItem) => (
                      <div key={requestItem.id} className="space-y-1">
                        <p className="text-xs font-semibold text-amber-800">
                          Pending {formatLabel(requestItem.type)} request
                        </p>
                        <p className="text-xs text-amber-800">{requestItem.reason}</p>
                        {requestItem.requestedBy?.fullName ? (
                          <p className="text-[11px] text-amber-700">
                            Requested by {requestItem.requestedBy.fullName}
                          </p>
                        ) : null}
                        {requestItem.requestedScheduleAt ? (
                          <p className="text-[11px] text-amber-700">
                            Proposed:{' '}
                            {new Date(requestItem.requestedScheduleAt).toLocaleString('en-US', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </p>
                        ) : null}
                        {canManageVisitRequests ? (
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={resolvingVisitRequestId === requestItem.id}
                              onClick={() =>
                                openResolveRequestDialog(
                                  visit.id,
                                  requestItem.id,
                                  requestItem.type === 'RESCHEDULE' ? 'RESCHEDULE' : 'CANCEL',
                                  requestItem.requestedScheduleAt,
                                )
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={resolvingVisitRequestId === requestItem.id}
                              onClick={() =>
                                handleRejectVisitRequest(visit.id, requestItem.id)
                              }
                            >
                              Reject
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {visit.result ? (
                  <div className="mt-2 space-y-1 rounded-md border border-border bg-background/70 p-2">
                    <p className="text-xs font-semibold text-foreground">Visit Result</p>
                    <div className={blurVisitResult ? 'blur-xs pointer-events-none select-none' : ''}>
                      <p className="text-xs text-muted-foreground">{visit.result.summary}</p>
                      {visit.result.clientMood ? (
                        <p className="text-xs text-muted-foreground">
                          Client Mood: {formatLabel(visit.result.clientMood)}
                        </p>
                      ) : null}
                      <p className="text-[11px] text-muted-foreground">
                        Submitted:{' '}
                        {new Date(visit.result.completedAt).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                      {visit.result.files.length > 0 ? (
                        <div className="pt-1 space-y-1">
                          {visit.result.files.map((file) => (
                            <a
                              key={file.id}
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-[11px] text-primary underline-offset-2 hover:underline"
                            >
                              {file.fileName}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Quick Actions */}
      {scheduledVisitCard ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visit Scheduled</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="font-medium text-foreground">{scheduledVisitCard.assignedToName}</div>
            <div className="text-muted-foreground">{scheduledVisitCard.assignedToEmail}</div>
            <div className="text-muted-foreground">
              {new Date(scheduledVisitCard.scheduledAt).toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </div>
            <div className="text-muted-foreground">{scheduledVisitCard.location}</div>
            <div className="text-muted-foreground">Visit Fee: Tk {scheduledVisitCard.visitFee ?? 0}</div>
            {scheduledVisitCard.projectSqft ? (
              <div className="text-muted-foreground">Sqft: {scheduledVisitCard.projectSqft}</div>
            ) : null}
            {scheduledVisitCard.projectStatus ? (
              <div className="text-muted-foreground">
                Project Status: {formatLabel(scheduledVisitCard.projectStatus)}
              </div>
            ) : null}
            {scheduledVisitCard.notes ? (
              <p className="text-muted-foreground">{scheduledVisitCard.notes}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canScheduleVisit ? (
            <Button
              className="w-full justify-start gap-2"
              variant="outline"
              onClick={() => setVisitOpen(true)}
              disabled={isLatestVisitResultPending}
              title={scheduleVisitDisabledReason ?? undefined}
            >
              <Plus className="w-4 h-4" />
              Schedule Visit
            </Button>
          ) : null}
          {canScheduleVisit && scheduleVisitDisabledReason ? (
            <p className="text-xs text-muted-foreground">{scheduleVisitDisabledReason}</p>
          ) : null}
          {canSubmitVisitResult ? (
            <Button
              className="w-full justify-start gap-2"
              variant="outline"
              onClick={() => handleVisitResultOpenChange(true)}
            >
              <Plus className="w-4 h-4" />
              Add Visit Result
            </Button>
          ) : null}
          {canAddFollowup ? (
            <Button
              className="w-full justify-start gap-2"
              variant="outline"
              onClick={onAddFollowup}
            >
              <Plus className="w-4 h-4" />
              Add Followup
            </Button>
          ) : null}
          <Button
            className="w-full justify-start gap-2"
            variant="outline"
            onClick={onAddLeadDetails}
            disabled={!onAddLeadDetails}
          >
            <Plus className="w-4 h-4" />
            Add Lead Details
          </Button>
          <Button
            className="w-full justify-start gap-2"
            variant="outline"
            onClick={onAddAttachment}
            disabled={!onAddAttachment}
          >
            <Plus className="w-4 h-4" />
            Add Attachment
          </Button>
          <Button
            className="w-full justify-start gap-2"
            variant="outline"
            disabled={!canWhatsapp || sendingWhatsapp}
            onClick={() => void handleSendWhatsapp()}
          >
            <MessageCircle className="w-4 h-4" />
            {sendingWhatsapp ? 'Sending WhatsApp...' : 'Send WhatsApp'}
          </Button>
          <Button
            className="w-full justify-start gap-2"
            variant="outline"
            disabled={!canEmail}
            onClick={() => {
              if (!emailUrl) return
              window.open(emailUrl, '_blank', 'noopener,noreferrer')
            }}
          >
            <Mail className="w-4 h-4" />
            Send Email
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={supportDialogOpen}
        onOpenChange={(open) => {
          setSupportDialogOpen(open)
          if (!open) {
            setSupportDialogVisitId('')
            setAvailableSupportMembers([])
            setSupportMemberSelection('')
            setSupportDialogError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Support Member</DialogTitle>
            <DialogDescription>
              Assign support from the visit team for this lead visit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedSupportVisit ? (
              <div className="rounded-md border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">
                  {selectedSupportVisit.assignedTo?.fullName ?? 'Unassigned Lead'}
                </p>
                <p>
                  {new Date(selectedSupportVisit.scheduledAt).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
                <p>{selectedSupportVisit.location}</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Support Member</Label>
              <Select
                value={supportMemberSelection}
                onValueChange={setSupportMemberSelection}
                disabled={loadingSupportMembers || availableSupportMembers.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingSupportMembers
                        ? 'Loading visit team members...'
                        : availableSupportMembers.length === 0
                          ? 'No available members'
                          : 'Select support member'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableSupportMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.fullName} ({member.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {supportDialogError ? <p className="text-sm text-destructive">{supportDialogError}</p> : null}
          </div>

          <DialogFooter>
            <Button
              onClick={handleAddSupportMember}
              disabled={savingSupportMember || loadingSupportMembers || !supportMemberSelection}
            >
              {savingSupportMember ? 'Saving...' : 'Add Support Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resolveRequestOpen}
        onOpenChange={(open) => {
          setResolveRequestOpen(open)
          if (!open) {
            setResolveError(null)
            setResolveVisitId('')
            setResolveRequestId('')
            setResolveRequestType('')
            setResolveScheduledAt('')
            setResolveReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Visit {resolveRequestType || 'Update'} Request</DialogTitle>
            <DialogDescription>
              Confirm this request. Lead stage and visit status will update automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {resolveRequestType === 'RESCHEDULE' ? (
              <div className="space-y-2">
                <Label>Rescheduled date & time</Label>
                <Input
                  type="datetime-local"
                  value={resolveScheduledAt}
                  step={3600}
                  className={dateTimeInputClassName}
                  onChange={(event) => setResolveScheduledAt(toHourPrecisionLocalDateTime(event.target.value))}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                value={resolveReason}
                onChange={(event) => setResolveReason(event.target.value)}
                rows={3}
                placeholder="Add approval reason..."
              />
            </div>

            {resolveError ? <p className="text-sm text-destructive">{resolveError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              onClick={handleApproveVisitRequest}
              disabled={Boolean(resolvingVisitRequestId)}
            >
              {resolvingVisitRequestId ? 'Saving...' : 'Approve Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={visitResultOpen} onOpenChange={handleVisitResultOpenChange}>
        <DialogContent className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col rounded-none p-0 sm:top-[50%] sm:left-[50%] sm:h-auto sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-6">
          <DialogHeader className="border-b px-4 py-3 sm:border-0 sm:px-0 sm:py-0">
            <DialogTitle>{isVisitResultUpdate ? 'Update visit result' : 'Add visit result'}</DialogTitle>
            <DialogDescription>
              {visitResultRole === 'SUPPORT'
                ? isVisitResultUpdate
                  ? 'Update your support data for this visit.'
                  : 'Submit support data for this visit.'
                : isVisitResultUpdate
                  ? 'Update the on-site outcome for this visit.'
                  : 'Submit the on-site outcome. This will mark the lead as Visit Completed.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-0 sm:py-4">
            <div className="space-y-2">
              <Label>Visit</Label>
              <Select value={visitResultVisitId} onValueChange={setVisitResultVisitId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      visitResultCandidates.length === 0
                        ? 'No pending visits to complete'
                        : 'Select a visit'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {visitResultCandidates.map((visit) => (
                    <SelectItem key={visit.id} value={visit.id}>
                      {new Date(visit.scheduledAt).toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}{' '}
                      - {visit.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loadingVisitResultData ? (
              <div className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
                Loading existing visit result...
              </div>
            ) : null}

            {visitResultRole === 'LEAD' &&
            selectedVisitResult &&
            hasPendingPrimarySupportResult(selectedVisitResult) ? (
              <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                This visit cannot be completed yet. The first support member must submit support data first.
              </div>
            ) : null}

            {visitResultRole === 'SUPPORT' ? (
              <>
                <div className="space-y-2">
                  <Label>Client Name</Label>
                  <Input
                    value={visitResultSupportClientName}
                    onChange={(event) => setVisitResultSupportClientName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Project Area</Label>
                  <Input
                    value={visitResultSupportProjectArea}
                    onChange={(event) => setVisitResultSupportProjectArea(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Project Status</Label>
                  <Input
                    value={visitResultSupportProjectStatus}
                    onChange={(event) => setVisitResultSupportProjectStatus(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Extra Concern (optional)</Label>
                  <Textarea
                    value={visitResultSupportExtraConcern}
                    onChange={(event) => setVisitResultSupportExtraConcern(event.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Attachments (optional)</Label>
                  <Input
                    type="file"
                    multiple
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? [])
                      setVisitResultFiles(files)
                    }}
                  />
                </div>
              </>
            ) : (
              <Tabs defaultValue="outcome" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="outcome">Outcome</TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="files">Files</TabsTrigger>
                </TabsList>
                <TabsContent value="outcome" className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label>Summary</Label>
                    <Textarea
                      value={visitResultSummary}
                      onChange={(event) => setVisitResultSummary(event.target.value)}
                      rows={4}
                      placeholder="Write visit outcome summary..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Client mood (optional)</Label>
                    <Select
                      value={visitResultClientMood || selectUnsetValue}
                      onValueChange={(value) =>
                        setVisitResultClientMood(value === selectUnsetValue ? '' : value)
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
                  <div className="space-y-2">
                    <Label>Project Status (optional)</Label>
                    <Select value={visitResultProjectStatus} onValueChange={setVisitResultProjectStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UNDER_CONSTRUCTION">Under Construction</SelectItem>
                        <SelectItem value="READY">Ready</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Note (optional)</Label>
                    <Textarea
                      value={visitResultNote}
                      onChange={(event) => setVisitResultNote(event.target.value)}
                      rows={3}
                      placeholder="Add note for the lead timeline..."
                    />
                  </div>
                </TabsContent>
                <TabsContent value="details" className="mt-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Potentiality / Hotness</Label>
                      <Select
                        value={visitResultClientPotentiality || selectUnsetValue}
                        onValueChange={(value) =>
                          setVisitResultClientPotentiality(value === selectUnsetValue ? '' : value)
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
                        value={visitResultProjectType || selectUnsetValue}
                        onValueChange={(value) =>
                          setVisitResultProjectType(value === selectUnsetValue ? '' : value)
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
                        value={visitResultClientPersonality || selectUnsetValue}
                        onValueChange={(value) =>
                          setVisitResultClientPersonality(value === selectUnsetValue ? '' : value)
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
                        value={visitResultBudgetRange || selectUnsetValue}
                        onValueChange={(value) =>
                          setVisitResultBudgetRange(value === selectUnsetValue ? '' : value)
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
                        value={visitResultTimelineUrgency || selectUnsetValue}
                        onValueChange={(value) =>
                          setVisitResultTimelineUrgency(value === selectUnsetValue ? '' : value)
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
                        value={visitResultStylePreference || selectUnsetValue}
                        onValueChange={(value) =>
                          setVisitResultStylePreference(value === selectUnsetValue ? '' : value)
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
                </TabsContent>
                <TabsContent value="files" className="mt-4 space-y-2">
                  <Label>Attachments (optional)</Label>
                  <Input
                    type="file"
                    multiple
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? [])
                      setVisitResultFiles(files)
                    }}
                  />
                </TabsContent>
              </Tabs>
            )}

            {visitResultError ? <p className="text-sm text-destructive">{visitResultError}</p> : null}
          </div>

          <DialogFooter className="border-t px-4 py-3 sm:border-0 sm:px-0 sm:py-0">
            <Button
              onClick={handleSubmitVisitResult}
              disabled={
                submittingVisitResult ||
                loadingVisitResultData ||
                visitResultCandidates.length === 0 ||
                !visitResultVisitId ||
                visitResultRole === 'NONE' ||
                (visitResultRole === 'LEAD' &&
                  Boolean(hasPendingPrimarySupportResult(selectedVisitResult)))
              }
            >
              {submittingVisitResult
                ? 'Saving...'
                : loadingVisitResultData
                  ? 'Loading...'
                : visitResultRole === 'SUPPORT'
                  ? isVisitResultUpdate
                    ? 'Update Support Data'
                    : 'Submit Support Data'
                  : isVisitResultUpdate
                    ? 'Update Visit Result'
                    : 'Submit Visit Result'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={visitOpen} onOpenChange={handleVisitOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule visit</DialogTitle>
            <DialogDescription>
              Assign a visit team member and set the visit details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Visit team member</Label>
              <Select
                value={visitTeamUserId}
                onValueChange={setVisitTeamUserId}
                disabled={visitTeamLoading || visitTeamUsers.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      visitTeamLoading
                        ? 'Loading team...'
                        : visitTeamUsers.length === 0
                          ? 'No visit team members'
                          : 'Select member'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {visitTeamUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Scheduled date & time</Label>
              <Input
                type="datetime-local"
                value={visitScheduledAt}
                step={3600}
                className={dateTimeInputClassName}
                onChange={(event) => setVisitScheduledAt(toHourPrecisionLocalDateTime(event.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Lead / Visit Location</Label>
              <Input
                value={visitLocation}
                onChange={(event) => {
                  locationTouchedRef.current = true
                  setVisitLocation(event.target.value)
                }}
                placeholder="Location (will update lead location)"
              />
            </div>

            <div className="space-y-2">
              <Label>Visit Fee (Tk)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={visitFee}
                onChange={(event) => setVisitFee(event.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label>Project Sqft (optional)</Label>
              <Input
                type="number"
                min="1"
                value={visitProjectSqft}
                onChange={(event) => setVisitProjectSqft(event.target.value)}
                placeholder="Enter project sqft"
              />
            </div>

            <div className="space-y-2">
              <Label>Project Status (optional)</Label>
              <Select value={visitProjectStatus} onValueChange={setVisitProjectStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNDER_CONSTRUCTION">Under Construction</SelectItem>
                  <SelectItem value="READY">Ready</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Attachment (optional)</Label>
              <Input
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  setVisitAttachmentFile(file)
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={visitNotes}
                onChange={(event) => setVisitNotes(event.target.value)}
                placeholder="Optional notes"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={visitReason}
                onChange={(event) => setVisitReason(event.target.value)}
                onPointerDown={() => {
                  if (!didClearVisitDefaultReason && visitReason === defaultVisitReason) {
                    setVisitReason('')
                    setDidClearVisitDefaultReason(true)
                  }
                }}
                placeholder="Reason for scheduling this visit"
                rows={3}
              />
            </div>

            {visitTeamError ? (
              <p className="text-sm text-destructive">{visitTeamError}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button onClick={handleScheduleVisit} disabled={visitSaving}>
              {visitSaving ? 'Saving...' : 'Schedule visit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
