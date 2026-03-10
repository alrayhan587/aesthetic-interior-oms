'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [followups, setFollowups] = useState<Followup[]>([])

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
        setActivities(data.data?.activities || [])
        setFollowups(data.data?.followUps || [])
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error fetching lead:', error)
        setLoading(false)
      })
  }, [leadId])

  // Fetch assignments
  useEffect(() => {
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

  const handleUpdateStage = async () => {
    try {
      const response = await fetch(`/api/lead/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      })
      const data = await response.json()
      if (data.success) {
        setLead(data.data)
      }
    } catch (error) {
      console.error('Error updating stage:', error)
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
          <LeadInfoCard lead={lead} stage={stage} />

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
              <LeadFollowupsTab followups={followups} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Action Panel - Sidebar */}
        <div className="lg:col-span-1">
          <LeadActionsPanel
            assignments={assignments}
            assignmentsLoading={assignmentsLoading}
            stage={stage}
            onStageChange={setStage}
            onUpdateStage={handleUpdateStage}
          />
        </div>
      </div>
    </div>
  )
}
