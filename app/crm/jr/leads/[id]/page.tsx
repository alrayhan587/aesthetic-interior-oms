'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, MessageSquare, History, Calendar, FileText, ImageIcon, Video } from 'lucide-react'
import { LeadInfoCard } from '@/components/crm/junior/lead-info-card'
import { LeadNotesTab } from '@/components/crm/junior/lead-notes-tab'
import { LeadActivityTab } from '@/components/crm/junior/lead-activity-tab'
import { LeadFollowupsTab } from '@/components/crm/junior/lead-followups-tab'
import { LeadActionsPanel } from '@/components/crm/junior/lead-actions-panel'
import { SrCommandPanel } from '@/components/crm/senior/sr-command-panel'
import { fetchMeCached } from '@/lib/client-me'
import { FacebookMessagesDialog } from '@/components/crm/shared/facebook-messages-dialog'

type LeadDetails = {
  id: string
  name: string
  phone: string | null
  email: string | null
  source: string | null
  stage: string
  subStatus: string | null
  budget: number | null
  location: string | null
  remarks: string | null
  assignedTo: string | null
  created_at: string
  updated_at: string
  assignee?: {
    id: string
    fullName: string
    email: string
  } | null
  primaryOwner?: {
    id: string
    fullName: string
    email: string
  } | null
  phaseTasks?: Array<{
    id: string
    phaseType: 'CAD' | 'QUOTATION'
    assigneeUserId: string
    dueAt: string
    status: 'OPEN' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED'
    currentReviewRound: number
    assignee?: {
      id: string
      fullName: string
      email: string
    } | null
  }>
  meetingEvents?: Array<{
    id: string
    type: 'FIRST_MEETING' | 'BUDGET_MEETING' | 'REVIEW_CHECKPOINT'
    title: string
    startsAt: string
    endsAt: string | null
  }>
  activities?: Activity[]
  followUps?: Followup[]
  attachments?: LeadAttachment[]
  visits?: Array<{
    id: string
    scheduledAt: string
    projectSqft: number | null
    projectStatus: string | null
  }>
}

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

type Note = {
  id: string
  content: string
  createdAt: string
  user: {
    id: string
    fullName: string
    email: string
  }
  lead: {
    id: string
    name: string
    email: string
  }
}

type Activity = {
  id: string
  type: string
  description: string
  createdAt: string
  user: {
    id: string
    fullName: string
    email: string
  }
}

type Followup = {
  id: string
  followupDate: string
  notes: string
  status: string
  assignedTo: {
    id: string
    fullName: string
    email: string
  }
}

type LeadAttachment = {
  id: string
  url: string
  fileName: string
  fileType: string
  category: string
  sizeBytes: number | null
  createdAt: string
}

function toIsoFromLocalDateTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid follow-up date and time.')
  }
  return parsed.toISOString()
}

type LeadTabValue = 'notes' | 'activity' | 'followups' | 'attachments'

export default function LeadDetailPage() {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const leadId = params.id as string

  const searchParams = useSearchParams()
  const openScheduleOnMount = Boolean(searchParams.get('openSchedule'))

  const [lead, setLead] = useState<LeadDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [notesLoading, setNotesLoading] = useState(false)
  const [stage, setStage] = useState('NEW')
  const [subStatus, setSubStatus] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [followups, setFollowups] = useState<Followup[]>([])
  const [attachments, setAttachments] = useState<LeadAttachment[]>([])
  const [activeTab, setActiveTab] = useState<LeadTabValue>('notes')
  const [activityLoading, setActivityLoading] = useState(false)
  const [followupsLoading, setFollowupsLoading] = useState(false)
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const [hasLoadedActivity, setHasLoadedActivity] = useState(false)
  const [hasLoadedFollowups, setHasLoadedFollowups] = useState(false)
  const [hasLoadedAttachments, setHasLoadedAttachments] = useState(false)
  const [addFollowupOpen, setAddFollowupOpen] = useState(false)
  const [followupDate, setFollowupDate] = useState('')
  const [followupNotes, setFollowupNotes] = useState('')
  const [addFollowupError, setAddFollowupError] = useState<string | null>(null)
  const [addingFollowup, setAddingFollowup] = useState(false)
  const [addAttachmentOpen, setAddAttachmentOpen] = useState(false)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [addAttachmentError, setAddAttachmentError] = useState<string | null>(null)
  const [addingAttachment, setAddingAttachment] = useState(false)
  const [addLeadDetailsOpen, setAddLeadDetailsOpen] = useState(false)
  const [leadDetailsName, setLeadDetailsName] = useState('')
  const [leadDetailsEmail, setLeadDetailsEmail] = useState('')
  const [leadDetailsPhone, setLeadDetailsPhone] = useState('')
  const [leadDetailsLocation, setLeadDetailsLocation] = useState('')
  const [leadDetailsSource, setLeadDetailsSource] = useState('')
  const [leadDetailsBudget, setLeadDetailsBudget] = useState('')
  const [leadDetailsRemarks, setLeadDetailsRemarks] = useState('')
  const [leadDetailsError, setLeadDetailsError] = useState<string | null>(null)
  const [savingLeadDetails, setSavingLeadDetails] = useState(false)
  const [canManageAssignments, setCanManageAssignments] = useState(false)
  const [canManageVisitRequests, setCanManageVisitRequests] = useState(false)
  const isVisitTeamView = pathname?.startsWith('/visit-team/') ?? false
  const isSeniorCrmView = pathname?.startsWith('/crm/sr/') ?? false
  const isJuniorCrmView = pathname?.startsWith('/crm/jr/') ?? false
  const blurVisitResult = pathname?.startsWith('/crm/jr/') ?? false
  const backHref = useMemo(() => {
    let basePath = '/crm/jr/leads'
    if (pathname?.startsWith('/crm/sr/')) basePath = '/crm/sr/lead-journey'
    else if (pathname?.startsWith('/crm/admin/')) basePath = '/crm/admin/leads'
    else if (pathname?.startsWith('/visit-team/')) basePath = '/visit-team/visit-today'

    const params = new URLSearchParams(searchParams.toString())
    params.delete('openSchedule')
    const query = params.toString()
    return query ? `${basePath}?${query}` : basePath
  }, [pathname, searchParams])

  // Fetch current user
  useEffect(() => {
    if (typeof window === 'undefined') return

    const applyUserPayload = (data: { id: string | null; userDepartments: Array<{ department?: { name?: string | null } | null }> }) => {
      if (data.id) setCurrentUserId(data.id)
      const departments = Array.isArray(data?.userDepartments) ? data.userDepartments : []
      const departmentNames = departments
        .map((entry) => entry?.department?.name)
        .filter((name: string | null | undefined): name is string => Boolean(name))
      setCanManageAssignments(departmentNames.includes('ADMIN'))
      setCanManageVisitRequests(
        departmentNames.includes('JR_CRM') || departmentNames.includes('ADMIN'),
      )
    }

    fetchMeCached()
      .then(data => {
        applyUserPayload({
          id: data?.id ?? null,
          userDepartments: Array.isArray(data?.userDepartments) ? data.userDepartments : [],
        })
      })
      .catch((error) => console.error('Error fetching user:', error))
  }, [])

  const refreshLeadDetails = useCallback(() => {
    setLoading(true)
    fetch(
      `/api/lead/${leadId}?includeFollowUps=false&includeAttachments=false&includeNotes=false&includeActivities=false&includeStatusHistory=false`,
    )
      .then(res => res.json())
      .then(data => {
        setLead(data.data)
        setStage(data.data?.stage || 'NEW')
        setSubStatus(data.data?.subStatus ?? null)
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error fetching lead:', error)
        setLoading(false)
      })
  }, [leadId])

  // Fetch lead details
  useEffect(() => {
    refreshLeadDetails()
  }, [refreshLeadDetails])

  useEffect(() => {
    setHasLoadedActivity(false)
    setHasLoadedFollowups(false)
    setHasLoadedAttachments(false)
  }, [leadId])

  const refreshFollowups = useCallback(() => {
    setFollowupsLoading(true)
    fetch(`/api/followup/${leadId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setFollowups(data.data)
        }
        setHasLoadedFollowups(true)
        setFollowupsLoading(false)
      })
      .catch((error) => {
        console.error('Error fetching followups:', error)
        setFollowupsLoading(false)
      })
  }, [leadId])

  const refreshAttachments = useCallback(() => {
    setAttachmentsLoading(true)
    fetch(`/api/lead/${leadId}/attachments`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setAttachments(data.data)
        }
        setHasLoadedAttachments(true)
        setAttachmentsLoading(false)
      })
      .catch((error) => {
        console.error('Error fetching attachments:', error)
        setAttachmentsLoading(false)
      })
  }, [leadId])

  const refreshActivities = useCallback(() => {
    setActivityLoading(true)
    fetch(`/api/activity-log/${leadId}?limit=30`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setActivities(data.data)
        }
        setHasLoadedActivity(true)
        setActivityLoading(false)
      })
      .catch((error) => {
        console.error('Error fetching activities:', error)
        setActivityLoading(false)
      })
  }, [leadId])

  const refreshAssignments = useCallback(() => {
    setAssignmentsLoading(true)
    fetch(`/api/lead/${leadId}/assignments`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data?.assignments) {
          setAssignments(data.data.assignments)
        }
        setAssignmentsLoading(false)
      })
      .catch((error) => {
        console.error('Error fetching assignments:', error)
        setAssignmentsLoading(false)
      })
  }, [leadId])

  // Fetch assignments
  useEffect(() => {
    refreshAssignments()
  }, [refreshAssignments])

  // Fetch notes
  useEffect(() => {
    setNotesLoading(true)
    fetch(`/api/note/${leadId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setNotes(data.data)
        setNotesLoading(false)
      })
      .catch((error) => {
        console.error('Error fetching notes:', error)
        setNotesLoading(false)
      })
  }, [leadId])

  useEffect(() => {
    if (activeTab === 'activity' && !hasLoadedActivity) {
      refreshActivities()
    }
    if (activeTab === 'followups' && !hasLoadedFollowups) {
      refreshFollowups()
    }
    if (activeTab === 'attachments' && !hasLoadedAttachments) {
      refreshAttachments()
    }
  }, [
    activeTab,
    hasLoadedActivity,
    hasLoadedFollowups,
    hasLoadedAttachments,
    refreshActivities,
    refreshFollowups,
    refreshAttachments,
  ])

  const hasPendingFollowup = useMemo(
    () => followups.some((followup) => followup.status === 'PENDING'),
    [followups],
  )

  const handleAddFollowupOpenChange = (open: boolean) => {
    setAddFollowupOpen(open)
    if (!open) {
      setFollowupDate('')
      setFollowupNotes('')
      setAddFollowupError(null)
    }
  }

  const handleAddFollowup = () => {
    setAddFollowupError(null)
    setAddFollowupOpen(true)
  }

  const handleAddAttachmentOpenChange = (open: boolean) => {
    setAddAttachmentOpen(open)
    if (!open) {
      setAttachmentFile(null)
      setAddAttachmentError(null)
    }
  }

  const handleAddLeadDetailsOpenChange = (open: boolean) => {
    setAddLeadDetailsOpen(open)
    if (!open) {
      setLeadDetailsError(null)
    }
  }

  const handleAddLeadDetails = () => {
    if (!lead) return
    setLeadDetailsName(lead.name ?? '')
    setLeadDetailsEmail(lead.email ?? '')
    setLeadDetailsPhone(lead.phone ?? '')
    setLeadDetailsLocation(lead.location ?? '')
    setLeadDetailsSource(lead.source ?? '')
    setLeadDetailsBudget(lead.budget !== null && lead.budget !== undefined ? String(lead.budget) : '')
    setLeadDetailsRemarks(lead.remarks ?? '')
    setLeadDetailsError(null)
    setAddLeadDetailsOpen(true)
  }

  // Handle adding a new note
  const handleAddNote = async () => {
    if (!newNote.trim() || !currentUserId) return

    setSubmittingNote(true)
    try {
      const response = await fetch(`/api/note/${leadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newNote,
          userId: currentUserId,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setNotes([data.data, ...notes])
        setNewNote('')
        refreshFollowups()
      }
    } catch (error) {
      console.error('Error adding note:', error)
    } finally {
      setSubmittingNote(false)
    }
  }

  const handleUpdateStage = async (reason: string, options?: { jrArchitectUserId?: string }) => {
    try {
      const response = await fetch(`/api/lead/${leadId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage,
          subStatus: subStatus || null,
          reason,
          userId: currentUserId,
          jrArchitectUserId: options?.jrArchitectUserId,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update stage')
      }
      setLead(data.data)
      setStage(data.data?.stage || stage)
      setSubStatus(data.data?.subStatus ?? null)
      refreshFollowups()
    } catch (error) {
      console.error('Error updating stage:', error)
      throw error
    }
  }

  const createFollowup = async (payload: { followupDate: string; notes?: string }) => {
    if (!currentUserId) {
      throw new Error('Unable to determine your user id.')
    }

    const response = await fetch(`/api/followup/${leadId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignedToId: currentUserId,
        followupDate: toIsoFromLocalDateTime(payload.followupDate),
        notes: payload.notes,
        userId: currentUserId,
      }),
    })

    const data = await response.json()
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to create follow-up.')
    }
  }

  const handleCreateFollowup = async () => {
    if (!followupDate) {
      setAddFollowupError('Please select a follow-up date.')
      return
    }
    setAddingFollowup(true)
    setAddFollowupError(null)
    try {
      await createFollowup({
        followupDate,
        notes: followupNotes.trim() || undefined,
      })
      handleAddFollowupOpenChange(false)
      refreshFollowups()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create follow-up.'
      setAddFollowupError(message)
    } finally {
      setAddingFollowup(false)
    }
  }

  const handleCreateAttachment = async () => {
    if (!attachmentFile) {
      setAddAttachmentError('Please select a file.')
      return
    }

    setAddingAttachment(true)
    setAddAttachmentError(null)

    try {
      const formData = new FormData()
      formData.append('file', attachmentFile)

      const response = await fetch(`/api/lead/${leadId}/attachments`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload attachment.')
      }

      handleAddAttachmentOpenChange(false)
      refreshAttachments()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload attachment.'
      setAddAttachmentError(message)
    } finally {
      setAddingAttachment(false)
    }
  }

  const handleSaveLeadDetails = async () => {
    setSavingLeadDetails(true)
    setLeadDetailsError(null)

    try {
      const normalizedBudget = leadDetailsBudget.trim()
      const budgetValue =
        normalizedBudget === '' ? null : Number.isFinite(Number(normalizedBudget)) ? Number(normalizedBudget) : null

      const response = await fetch(`/api/lead/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: leadDetailsName.trim() || lead?.name || '',
          email: leadDetailsEmail.trim() === '' ? null : leadDetailsEmail.trim().toLowerCase(),
          phone: leadDetailsPhone.trim() === '' ? null : leadDetailsPhone.trim(),
          location: leadDetailsLocation.trim() === '' ? null : leadDetailsLocation.trim(),
          source: leadDetailsSource.trim() === '' ? null : leadDetailsSource.trim(),
          budget: budgetValue,
          remarks: leadDetailsRemarks.trim() === '' ? null : leadDetailsRemarks.trim(),
          userId: currentUserId ?? undefined,
        }),
      })

      const payload = (await response.json()) as { success?: boolean; data?: LeadDetails; error?: string }
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Failed to save lead details')
      }

      setLead(payload.data)
      setAddLeadDetailsOpen(false)
    } catch (error) {
      setLeadDetailsError(error instanceof Error ? error.message : 'Failed to save lead details')
    } finally {
      setSavingLeadDetails(false)
    }
  }

  const mediaAttachments = attachments.filter((item) => item.category === 'MEDIA')
  const fileAttachments = attachments.filter((item) => item.category !== 'MEDIA')
  const formatSize = (sizeBytes: number | null) => {
    if (!sizeBytes || sizeBytes <= 0) return 'Unknown size'
    if (sizeBytes < 1024) return `${sizeBytes} B`
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <Button onClick={() => router.push(backHref)} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="mt-6 space-y-4 animate-pulse">
          <div className="h-28 rounded-xl bg-muted" />
          <div className="h-12 rounded-xl bg-muted" />
          <div className="h-60 rounded-xl bg-muted" />
        </div>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="p-4 sm:p-6">
        <Button onClick={() => router.push(backHref)} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <p className="mt-4 text-muted-foreground">Lead not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-3 sm:space-y-5 sm:p-4 lg:space-y-6 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button onClick={() => router.push(backHref)} variant="outline" size="sm" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <FacebookMessagesDialog leadId={leadId} source={lead.source} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Main Content */}
        <div className="space-y-4 lg:col-span-2 lg:space-y-6">
          {/* Lead Info Card */}
          <LeadInfoCard lead={lead} stage={stage} hasPendingFollowup={hasPendingFollowup} />

          {/* Tabs Section */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LeadTabValue)} className="w-full">
            {/* Tab List - Fixed Row Layout */}
            <TabsList className="grid h-auto w-full grid-cols-4 rounded-lg bg-muted p-1 text-muted-foreground lg:mx-auto lg:w-max lg:inline-flex lg:h-12 lg:items-center lg:justify-center">
              <TabsTrigger value="notes" className="flex items-center justify-center gap-2">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Notes</span>
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center justify-center gap-2">
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">Activity</span>
              </TabsTrigger>
              <TabsTrigger value="followups" className="flex items-center justify-center gap-2">
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">Followups</span>
              </TabsTrigger>
              <TabsTrigger value="attachments" className="flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Attachments</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab Content */}
            <TabsContent value="notes" className="mt-4 sm:mt-6">
              <LeadNotesTab
                notes={notes}
                notesLoading={notesLoading}
                newNote={newNote}
                submittingNote={submittingNote}
                onNoteChange={setNewNote}
                onAddNote={handleAddNote}
              />
            </TabsContent>

            <TabsContent value="activity" className="mt-4 sm:mt-6">
              {activityLoading ? (
                <div className="space-y-3 animate-pulse">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="h-24 rounded-lg border border-border bg-muted/40" />
                  ))}
                </div>
              ) : (
                <LeadActivityTab activities={activities} />
              )}
            </TabsContent>

            <TabsContent value="followups" className="mt-4 sm:mt-6">
              {followupsLoading ? (
                <div className="space-y-3 animate-pulse">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="h-24 rounded-lg border border-border bg-muted/40" />
                  ))}
                </div>
              ) : (
                <LeadFollowupsTab
                  followups={followups}
                  leadId={leadId}
                  currentUserId={currentUserId}
                  onRefreshFollowups={refreshFollowups}
                  onAddFollowup={handleAddFollowup}
                />
              )}
            </TabsContent>

            <TabsContent value="attachments" className="mt-4 sm:mt-6">
              {attachmentsLoading ? (
                <div className="space-y-3 animate-pulse">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="h-16 rounded-lg border border-border bg-muted/40" />
                  ))}
                </div>
              ) : (
              <div className="space-y-5 rounded-xl border border-border bg-card p-3 sm:p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Media</h3>
                  {mediaAttachments.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No media attachments yet.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {mediaAttachments.map((item) => (
                        <a
                          key={item.id}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between rounded-md border border-border px-3 py-2 hover:bg-secondary/40"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {item.fileType.startsWith('video/') ? (
                              <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="truncate text-sm text-foreground">{item.fileName}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatSize(item.sizeBytes)}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground">Files</h3>
                  {fileAttachments.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No file attachments yet.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {fileAttachments.map((item) => (
                        <a
                          key={item.id}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between rounded-md border border-border px-3 py-2 hover:bg-secondary/40"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate text-sm text-foreground">{item.fileName}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatSize(item.sizeBytes)}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Action Panel - Sidebar */}
        <div className="lg:col-span-1">
          {isSeniorCrmView && lead ? (
            <div className="mb-4">
              <SrCommandPanel
                lead={lead}
                currentUserId={currentUserId}
                onRefreshLead={refreshLeadDetails}
              />
            </div>
          ) : null}
          <LeadActionsPanel
            leadId={leadId}
            leadLocation={lead.location}
            leadPhone={lead.phone}
            leadEmail={lead.email}
            hasPendingFollowup={hasPendingFollowup}
            assignments={assignments}
            assignmentsLoading={assignmentsLoading}
            canManageAssignments={canManageAssignments}
            canManageVisitRequests={!isVisitTeamView && canManageVisitRequests}
            canManageStage={!isVisitTeamView}
            canSetVisitCompletedStage={!isJuniorCrmView}
            restrictStagesForJrCrm={isJuniorCrmView}
            canAddFollowup={!isVisitTeamView && !isSeniorCrmView}
            canScheduleVisit={!isVisitTeamView && !isSeniorCrmView}
            canSubmitVisitResult={isVisitTeamView}
            blurVisitResult={blurVisitResult}
            currentUserId={currentUserId}
            stage={stage}
            originalStage={lead.stage}
            subStatus={subStatus}
            originalSubStatus={lead.subStatus ?? null}
            onStageChange={setStage}
            onSubStatusChange={setSubStatus}
            onUpdateStage={handleUpdateStage}
            onCreateFollowupForStage={async ({ followupDate: requiredFollowupDate, notes }) => {
              await createFollowup({
                followupDate: requiredFollowupDate,
                notes,
              })
              refreshFollowups()
            }}
            onAssignmentsRefresh={refreshAssignments}
            onFollowupRefresh={refreshFollowups}
            onAttachmentRefresh={refreshAttachments}
            onAddFollowup={handleAddFollowup}
            onAddLeadDetails={handleAddLeadDetails}
            onAddAttachment={() => setAddAttachmentOpen(true)}
            onLeadRefresh={refreshLeadDetails}
            openScheduleOnMount={openScheduleOnMount}
          />
        </div>
      </div>

      <Dialog open={addLeadDetailsOpen} onOpenChange={handleAddLeadDetailsOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Lead Details</DialogTitle>
            <DialogDescription>
              Update lead basic details anytime. All fields are optional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={leadDetailsName} onChange={(event) => setLeadDetailsName(event.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={leadDetailsEmail}
                  onChange={(event) => setLeadDetailsEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={leadDetailsPhone} onChange={(event) => setLeadDetailsPhone(event.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={leadDetailsLocation} onChange={(event) => setLeadDetailsLocation(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Input value={leadDetailsSource} onChange={(event) => setLeadDetailsSource(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Budget</Label>
              <Input
                type="number"
                value={leadDetailsBudget}
                onChange={(event) => setLeadDetailsBudget(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                rows={4}
                value={leadDetailsRemarks}
                onChange={(event) => setLeadDetailsRemarks(event.target.value)}
              />
            </div>
            {leadDetailsError ? <p className="text-sm text-destructive">{leadDetailsError}</p> : null}
          </div>
          <DialogFooter>
            <Button onClick={handleSaveLeadDetails} disabled={savingLeadDetails}>
              {savingLeadDetails ? 'Saving...' : 'Save Details'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addFollowupOpen} onOpenChange={handleAddFollowupOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule follow-up</DialogTitle>
            <DialogDescription>
              Set a date and optional note for this follow-up.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Follow-up date</Label>
              <Input
                type="datetime-local"
                value={followupDate}
                onChange={(event) => setFollowupDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={followupNotes}
                onChange={(event) => setFollowupNotes(event.target.value)}
                placeholder="Optional notes for the follow-up..."
                rows={4}
              />
            </div>
            {addFollowupError ? (
              <p className="text-sm text-destructive">{addFollowupError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button onClick={handleCreateFollowup} disabled={addingFollowup}>
              {addingFollowup ? 'Saving...' : 'Create follow-up'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addAttachmentOpen} onOpenChange={handleAddAttachmentOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add attachment</DialogTitle>
            <DialogDescription>
              Upload a client file, media, or document to this lead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Attachment</Label>
              <Input
                type="file"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null
                  setAttachmentFile(nextFile)
                  setAddAttachmentError(null)
                }}
              />
            </div>
            {addAttachmentError ? (
              <p className="text-sm text-destructive">{addAttachmentError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button onClick={handleCreateAttachment} disabled={addingAttachment}>
              {addingAttachment ? 'Uploading...' : 'Upload attachment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
