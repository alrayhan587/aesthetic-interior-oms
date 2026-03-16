'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
import { ArrowLeft, MessageSquare, History, Calendar } from 'lucide-react'
import { LeadInfoCard } from '@/components/crm/junior/lead-info-card'
import { LeadNotesTab } from '@/components/crm/junior/lead-notes-tab'
import { LeadActivityTab } from '@/components/crm/junior/lead-activity-tab'
import { LeadFollowupsTab } from '@/components/crm/junior/lead-followups-tab'
import { LeadActionsPanel } from '@/components/crm/junior/lead-actions-panel'

type LeadDetails = {
  id: string
  name: string
  phone: string | null
  email: string
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
  activities?: Activity[]
  followUps?: Followup[]
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

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const leadId = params.id as string

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
  const [addFollowupOpen, setAddFollowupOpen] = useState(false)
  const [followupDate, setFollowupDate] = useState('')
  const [followupNotes, setFollowupNotes] = useState('')
  const [addFollowupError, setAddFollowupError] = useState<string | null>(null)
  const [addingFollowup, setAddingFollowup] = useState(false)

  // Fetch current user
  useEffect(() => {
    if (typeof window === 'undefined') return

    fetch('/api/me')
      .then(res => res.json())
      .then(data => {
        if (data.id) setCurrentUserId(data.id)
      })
      .catch((error) => console.error('Error fetching user:', error))
  }, [])

  // Fetch lead details
  useEffect(() => {
    setLoading(true)
    fetch(`/api/lead/${leadId}`)
      .then(res => res.json())
      .then(data => {
        setLead(data.data)
        setStage(data.data?.stage || 'NEW')
        setSubStatus(data.data?.subStatus ?? null)
        setActivities(data.data?.activities || [])
        setFollowups(data.data?.followUps || [])
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error fetching lead:', error)
        setLoading(false)
      })
  }, [leadId])

  const refreshFollowups = useCallback(() => {
    fetch(`/api/followup/${leadId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setFollowups(data.data)
        }
      })
      .catch((error) => {
        console.error('Error fetching followups:', error)
      })
  }, [leadId])

  useEffect(() => {
    refreshFollowups()
  }, [refreshFollowups])

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
    if (hasPendingFollowup) return
    setAddFollowupError(null)
    setAddFollowupOpen(true)
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
      }
    } catch (error) {
      console.error('Error adding note:', error)
    } finally {
      setSubmittingNote(false)
    }
  }

  const handleUpdateStage = async (reason: string) => {
    try {
      const response = await fetch(`/api/lead/${leadId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage,
          subStatus: subStatus || null,
          reason,
          userId: currentUserId,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update stage')
      }
      setLead(data.data)
      setStage(data.data?.stage || stage)
      setSubStatus(data.data?.subStatus ?? null)
    } catch (error) {
      console.error('Error updating stage:', error)
      throw error
    }
  }

  const handleCreateFollowup = async () => {
    if (!currentUserId) {
      setAddFollowupError('Unable to determine your user id.')
      return
    }
    if (!followupDate) {
      setAddFollowupError('Please select a follow-up date.')
      return
    }
    if (hasPendingFollowup) {
      setAddFollowupError('There is already a pending follow-up.')
      return
    }

    setAddingFollowup(true)
    setAddFollowupError(null)
    try {
      const response = await fetch(`/api/followup/${leadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedToId: currentUserId,
          followupDate,
          notes: followupNotes.trim() || undefined,
          userId: currentUserId,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create follow-up.')
      }

      handleAddFollowupOpenChange(false)
      refreshFollowups()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create follow-up.'
      setAddFollowupError(message)
    } finally {
      setAddingFollowup(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <Button onClick={() => router.back()} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <p className="mt-4 text-muted-foreground">Loading lead details...</p>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="p-6">
        <Button onClick={() => router.back()} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <p className="mt-4 text-muted-foreground">Lead not found</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button onClick={() => router.back()} variant="outline" size="sm" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lead Info Card */}
          <LeadInfoCard lead={lead} stage={stage} hasPendingFollowup={hasPendingFollowup} />

          {/* Tabs Section */}
          <Tabs defaultValue="notes" className="w-full">
            {/* Tab List - Fixed Row Layout */}
            <TabsList className="inline-flex h-12 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground lg:w-max lg:mx-auto">
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
            </TabsList>

            {/* Tab Content */}
            <TabsContent value="notes" className="mt-6">
              <LeadNotesTab
                notes={notes}
                notesLoading={notesLoading}
                newNote={newNote}
                submittingNote={submittingNote}
                onNoteChange={setNewNote}
                onAddNote={handleAddNote}
              />
            </TabsContent>

            <TabsContent value="activity" className="mt-6">
              <LeadActivityTab activities={activities} />
            </TabsContent>

            <TabsContent value="followups" className="mt-6">
              <LeadFollowupsTab
                followups={followups}
                leadId={leadId}
                currentUserId={currentUserId}
                hasPendingFollowup={hasPendingFollowup}
                onRefreshFollowups={refreshFollowups}
                onAddFollowup={handleAddFollowup}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Action Panel - Sidebar */}
        <div className="lg:col-span-1">
          <LeadActionsPanel
            leadId={leadId}
            leadLocation={lead.location}
            assignments={assignments}
            assignmentsLoading={assignmentsLoading}
            stage={stage}
            originalStage={lead.stage}
            subStatus={subStatus}
            originalSubStatus={lead.subStatus ?? null}
            onStageChange={setStage}
            onSubStatusChange={setSubStatus}
            onUpdateStage={handleUpdateStage}
            onAssignmentsRefresh={refreshAssignments}
            hasPendingFollowup={hasPendingFollowup}
            onAddFollowup={handleAddFollowup}
          />
        </div>
      </div>

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
    </div>
  )
}
