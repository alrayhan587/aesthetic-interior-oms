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
import { User, TrendingUp, Plus, Mail, MessageCircle } from 'lucide-react'
import { toast } from '@/components/ui/sonner'

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
  canAddFollowup?: boolean
  canScheduleVisit?: boolean
  canSubmitVisitResult?: boolean
  blurVisitResult?: boolean
  canManageVisitRequests?: boolean
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
  onLeadRefresh?: () => void
}

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
  canAddFollowup = true,
  canScheduleVisit = true,
  canSubmitVisitResult = false,
  blurVisitResult = false,
  canManageVisitRequests = false,
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
  onLeadRefresh,
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
  const [visitProjectSqft, setVisitProjectSqft] = useState('')
  const [visitProjectStatus, setVisitProjectStatus] = useState('')
  const [visitAttachmentFile, setVisitAttachmentFile] = useState<File | null>(null)
  const [visitNotes, setVisitNotes] = useState('')
  const [visitReason, setVisitReason] = useState('')
  const [visitSaving, setVisitSaving] = useState(false)
  const [scheduledVisitCard, setScheduledVisitCard] = useState<ScheduledVisitCard | null>(null)
  const [leadVisits, setLeadVisits] = useState<LeadVisitRecord[]>([])
  const [leadVisitsLoading, setLeadVisitsLoading] = useState(false)
  const [resolvingVisitRequestId, setResolvingVisitRequestId] = useState<string | null>(null)
  const [visitResultOpen, setVisitResultOpen] = useState(false)
  const [visitResultVisitId, setVisitResultVisitId] = useState('')
  const [visitResultSummary, setVisitResultSummary] = useState('')
  const [visitResultClientMood, setVisitResultClientMood] = useState('')
  const [visitResultMeasurements, setVisitResultMeasurements] = useState('')
  const [visitResultFiles, setVisitResultFiles] = useState<File[]>([])
  const [visitResultError, setVisitResultError] = useState<string | null>(null)
  const [submittingVisitResult, setSubmittingVisitResult] = useState(false)
  const locationTouchedRef = useRef(false)
  const locationPrefilledRef = useRef(false)

  const stageSubStatusMap: Record<string, string[]> = useMemo(
    () => ({
      NEW: [],
      NUMBER_COLLECTED: [],
      CONTACT_ATTEMPTED: ['NO_ANSWER'],
      NURTURING: ['WARM_LEAD', 'FUTURE_CLIENT'],
      VISIT_SCHEDULED: [],
      CLOSED: ['SMALL_BUDGET', 'INVALID', 'NOT_INTERESTED', 'LOST', 'DEAD_LEAD'],
    }),
    [],
  )

  const subStatusOptions = stageSubStatusMap[stage] ?? []
  const requiresSubStatus = subStatusOptions.length > 0
  const stageOrder: Record<string, number> = {
    NEW: 0,
    NUMBER_COLLECTED: 1,
    CONTACT_ATTEMPTED: 2,
    NURTURING: 3,
    VISIT_SCHEDULED: 4,
    VISIT_COMPLETED: 5,
    CLOSED: 6,
  }
  const originalStageRank = stageOrder[originalStage] ?? -1
  const selectedStageRank = stageOrder[stage] ?? -1
  const isForwardMove = selectedStageRank > originalStageRank
  const stageLockedAfterVisitScheduled =
    originalStageRank >= stageOrder.VISIT_SCHEDULED
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
  const requiresVisitSchedulingInStageModal = stage === 'VISIT_SCHEDULED'
  const canUpdateStage =
    (!requiresSubStatus || Boolean(subStatus)) &&
    hasStageChanged &&
    !stageLockedAfterVisitScheduled

  const validDepartments = [
    'ADMIN',
    'SR_CRM',
    'JR_CRM',
    'QUOTATION',
    'VISIT_TEAM',
    'JR_ARCHITECT',
    'VISUALIZER_3D',
  ]

  const formatLabel = (value: string) => value.replace(/_/g, ' ')
  const defaultReasonByStage: Record<string, string> = {
    NEW: 'Lead has been moved to new.',
    NUMBER_COLLECTED: 'Number has been collected.',
    CONTACT_ATTEMPTED: 'Contact has been attempted.',
    NURTURING: 'Lead has been moved to nurturing for follow-up.',
    VISIT_SCHEDULED: 'Visit has been scheduled.',
    VISIT_COMPLETED: 'Visit has been completed.',
    CLOSED: 'Lead has been closed.',
  }
  const defaultStageReason =
    defaultReasonByStage[stage] ?? 'Stage has been updated.'

  const normalizedPhone = leadPhone ? leadPhone.replace(/\D/g, '') : ''
  const canWhatsapp = Boolean(normalizedPhone)
  const canEmail = Boolean(leadEmail && leadEmail.trim())
  const whatsappUrl = canWhatsapp ? `https://wa.me/${normalizedPhone}` : ''
  const emailUrl = canEmail ? `mailto:${leadEmail}` : ''
  const shouldLoadVisitMetadata = visitOpen || (reasonOpen && requiresVisitSchedulingInStageModal)
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
          setLeadVisits(payload.data)
        } else {
          setLeadVisits([])
        }
      })
      .catch(() => setLeadVisits([]))
      .finally(() => setLeadVisitsLoading(false))
  }, [leadId])

  useEffect(() => {
    refreshLeadVisits()
  }, [refreshLeadVisits])

  const visitResultCandidates = useMemo(
    () =>
      leadVisits.filter(
        (visit) =>
          !visit.result &&
          (visit.status === 'SCHEDULED' || visit.status === 'RESCHEDULED'),
      ),
    [leadVisits],
  )

  const resetVisitResultForm = useCallback(() => {
    setVisitResultVisitId('')
    setVisitResultSummary('')
    setVisitResultClientMood('')
    setVisitResultMeasurements('')
    setVisitResultFiles([])
    setVisitResultError(null)
  }, [])

  const handleResolveVisitRequest = async (
    visitId: string,
    requestId: string,
    action: 'APPROVE' | 'REJECT',
  ) => {
    setResolvingVisitRequestId(requestId)
    try {
      const res = await fetch(`/api/visit-schedule/${visitId}/update-request/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const payload = await res.json()
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to resolve request')
      }
      refreshLeadVisits()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resolve request'
      toast.error(message)
    } finally {
      setResolvingVisitRequestId(null)
    }
  }

  const handleStageChange = (value: string) => {
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
      setStageError('After Visit Scheduled, CRM stage changes are locked.')
      return
    }
    if (!canUpdateStage) {
      setStageError('Select a substatus to continue.')
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
      if (!visitProjectSqft.trim() || Number(visitProjectSqft) <= 0) {
        setStageError('Please provide project sqft.')
        return
      }
      if (!visitProjectStatus) {
        setStageError('Please select project status.')
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
            projectSqft: Number(visitProjectSqft),
            projectStatus: visitProjectStatus,
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
        onStageChange('VISIT_SCHEDULED')
        onSubStatusChange(null)
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
    setVisitProjectSqft('')
    setVisitProjectStatus('')
    setVisitAttachmentFile(null)
    setVisitNotes('')
    setVisitReason('')
    setVisitTeamError(null)
    locationTouchedRef.current = false
    locationPrefilledRef.current = Boolean(leadLocation)
  }

  const handleVisitOpenChange = (open: boolean) => {
    setVisitOpen(open)
    if (!open) {
      resetVisitForm()
    }
  }

  const handleScheduleVisit = async () => {
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
    if (!visitProjectSqft.trim() || Number(visitProjectSqft) <= 0) {
      setVisitTeamError('Please provide project sqft.')
      return
    }
    if (!visitProjectStatus) {
      setVisitTeamError('Please select project status.')
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
          projectSqft: Number(visitProjectSqft),
          projectStatus: visitProjectStatus,
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
      onStageChange('VISIT_SCHEDULED')
      onSubStatusChange(null)
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

  const handleSubmitVisitResult = async () => {
    if (!visitResultVisitId) {
      setVisitResultError('Please select a visit.')
      return
    }
    if (!visitResultSummary.trim()) {
      setVisitResultError('Please add a visit summary.')
      return
    }

    setSubmittingVisitResult(true)
    setVisitResultError(null)
    try {
      const formData = new FormData()
      formData.append('summary', visitResultSummary.trim())
      if (visitResultClientMood.trim()) {
        formData.append('clientMood', visitResultClientMood.trim())
      }
      if (visitResultMeasurements.trim()) {
        formData.append('measurements', visitResultMeasurements.trim())
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

      toast.success('Visit result submitted and lead moved to Visit Completed.')
      setVisitResultOpen(false)
      resetVisitResultForm()
      onStageChange('VISIT_COMPLETED')
      onSubStatusChange(null)
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

  const handleDepartmentChange = async (value: string) => {
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
      onFollowupRefresh?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save assignment.'
      setAssignError(message)
    } finally {
      setAssigning(false)
    }
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
              <SelectItem value="NEW">New</SelectItem>
              <SelectItem value="NUMBER_COLLECTED">
                Number Collected
              </SelectItem>
              <SelectItem value="CONTACT_ATTEMPTED">
                Contact Attempted
              </SelectItem>
              <SelectItem value="NURTURING">
                Nurturing
              </SelectItem>
              <SelectItem value="VISIT_SCHEDULED">
                Visit Scheduled
              </SelectItem>
              <SelectItem value="VISIT_COMPLETED">
                Visit Completed
              </SelectItem>
              <SelectItem value="CLOSED">
                Closed
              </SelectItem>
            </SelectContent>
          </Select>

          {requiresSubStatus ? (
            <Select
              value={subStatus ?? ''}
              onValueChange={(value) => {
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
                  <SelectItem key={option} value={option}>
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
              Once the lead reaches Visit Scheduled, CRM stage updates are locked.
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
                    ? 'Add reason and visit details. Submitting will schedule the visit and move stage to Visit Scheduled.'
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
                        onChange={(event) => setVisitScheduledAt(event.target.value)}
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
                      <Label>Project Sqft</Label>
                      <Input
                        type="number"
                        min="1"
                        value={visitProjectSqft}
                        onChange={(event) => setVisitProjectSqft(event.target.value)}
                        placeholder="Enter project sqft"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Project Status</Label>
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
                  <span className="text-xs text-muted-foreground">{visit.status}</span>
                </div>
                <div className="text-muted-foreground">
                  {new Date(visit.scheduledAt).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </div>
                <div className="text-muted-foreground">{visit.location}</div>
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
                                handleResolveVisitRequest(visit.id, requestItem.id, 'APPROVE')
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={resolvingVisitRequestId === requestItem.id}
                              onClick={() =>
                                handleResolveVisitRequest(visit.id, requestItem.id, 'REJECT')
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
                          Client Mood: {visit.result.clientMood}
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
            >
              <Plus className="w-4 h-4" />
              Schedule Visit
            </Button>
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
            onClick={onAddAttachment}
            disabled={!onAddAttachment}
          >
            <Plus className="w-4 h-4" />
            Add Attachment
          </Button>
          <Button
            className="w-full justify-start gap-2"
            variant="outline"
            disabled={!canWhatsapp}
            onClick={() => {
              if (!whatsappUrl) return
              window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
            }}
          >
            <MessageCircle className="w-4 h-4" />
            Send WhatsApp
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

      <Dialog open={visitResultOpen} onOpenChange={handleVisitResultOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add visit result</DialogTitle>
            <DialogDescription>
              Submit the on-site outcome. This will mark the lead as Visit Completed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
              <Input
                value={visitResultClientMood}
                onChange={(event) => setVisitResultClientMood(event.target.value)}
                placeholder="e.g. Positive, concerned, undecided"
              />
            </div>

            <div className="space-y-2">
              <Label>Measurements JSON (optional)</Label>
              <Textarea
                value={visitResultMeasurements}
                onChange={(event) => setVisitResultMeasurements(event.target.value)}
                rows={3}
                placeholder='{"roomWidth": 12.5, "roomLength": 18}'
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

            {visitResultError ? <p className="text-sm text-destructive">{visitResultError}</p> : null}
          </div>

          <DialogFooter>
            <Button
              onClick={handleSubmitVisitResult}
              disabled={
                submittingVisitResult ||
                visitResultCandidates.length === 0 ||
                !visitResultVisitId
              }
            >
              {submittingVisitResult ? 'Saving...' : 'Submit Visit Result'}
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
                onChange={(event) => setVisitScheduledAt(event.target.value)}
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
              <Label>Project Sqft</Label>
              <Input
                type="number"
                min="1"
                value={visitProjectSqft}
                onChange={(event) => setVisitProjectSqft(event.target.value)}
                placeholder="Enter project sqft"
              />
            </div>

            <div className="space-y-2">
              <Label>Project Status</Label>
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
