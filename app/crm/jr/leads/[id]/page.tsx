'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Plus } from 'lucide-react'

const statusColors: Record<string, string> = {
  NEW: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
  CONTACTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  FOLLOWUP: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  VISIT_SCHEDULED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  CONVERTED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
}

type LeadDetails = {
  id: string
  name: string
  phone: string | null
  email: string
  source: string | null
  status: string
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
  id: string | number
  action: string
  description: string
  user: string
  date: string
}

type Followup = {
  id: string | number
  date: string
  type: string
  note: string
  status: string
}

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const leadId = params.id as string

  const [lead, setLead] = useState<LeadDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [notesLoading, setNotesLoading] = useState(false)
  const [status, setStatus] = useState('NEW')
  const [newNote, setNewNote] = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // These will be replaced with real API data in the future
  const [notes, setNotes] = useState<Note[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [followups, setFollowups] = useState<Followup[]>([])

  // Fetch current user
  useEffect(() => {
    console.log('[LeadDetail] phase=fetch_user_start timestamp=', new Date().toISOString());
    fetch('/api/me')
      .then(res => {
        console.log('[LeadDetail] phase=fetch_user_response status=', res.status);
        return res.json()
      })
      .then(data => {
        console.log('[LeadDetail] phase=fetch_user_parsed data.id=', data.id, 'data.error=', data.error);
        if (data.id) {
          console.log('[LeadDetail] phase=set_current_user_id userId=', data.id);
          setCurrentUserId(data.id)
        } else {
          console.log('[LeadDetail] phase=user_data_missing_id data=', JSON.stringify(data).substring(0, 200));
        }
      })
      .catch((error) => {
        console.error('[LeadDetail] phase=fetch_user_error error=', error.message, 'stack=', error.stack)
      })
  }, [])

  // Fetch lead details
  useEffect(() => {
    console.log('[LeadDetail] phase=fetch_lead_start leadId=', leadId, 'timestamp=', new Date().toISOString());
    setLoading(true)
    fetch(`/api/lead/${leadId}`)
      .then(res => {
        console.log('[LeadDetail] phase=fetch_lead_response leadId=', leadId, 'status=', res.status);
        return res.json()
      })
      .then(data => {
        console.log('[LeadDetail] phase=fetch_lead_parsed leadId=', leadId, 'success=', data.success, 'hasData=', Boolean(data.data));
        setLead(data.data)
        setStatus(data.data?.status || 'NEW')
        setActivities(data.data?.activities || [])
        setFollowups(data.data?.followUps || [])
        setLoading(false)
      })
      .catch((error) => {
        console.error('[LeadDetail] phase=fetch_lead_error leadId=', leadId, 'error=', error.message, 'stack=', error.stack);
        setLoading(false)
      })
  }, [leadId])

  // Fetch notes for the lead
  useEffect(() => {
    console.log('[LeadDetail] phase=fetch_notes_start leadId=', leadId, 'timestamp=', new Date().toISOString());
    setNotesLoading(true)
    fetch(`/api/note/${leadId}`)
      .then(res => {
        console.log('[LeadDetail] phase=fetch_notes_response leadId=', leadId, 'status=', res.status);
        return res.json()
      })
      .then(data => {
        console.log('[LeadDetail] phase=fetch_notes_parsed leadId=', leadId, 'success=', data.success, 'count=', data.data?.length || 0, 'error=', data.error);
        if (data.success) {
          console.log('[LeadDetail] phase=set_notes leadId=', leadId, 'notesCount=', data.data.length);
          setNotes(data.data)
        } else {
          console.log('[LeadDetail] phase=fetch_notes_failed leadId=', leadId, 'error=', data.error);
        }
        setNotesLoading(false)
      })
      .catch((error) => {
        console.error('[LeadDetail] phase=fetch_notes_error leadId=', leadId, 'error=', error.message, 'stack=', error.stack);
        setNotesLoading(false)
      })
  }, [leadId])

  // Handle adding a new note
  const handleAddNote = async () => {
    console.log('[LeadDetail] phase=handle_add_note_start leadId=', leadId, 'currentUserId=', currentUserId, 'noteLength=', newNote.trim().length);
    
    if (!newNote.trim() || !currentUserId) {
      console.warn('[LeadDetail] phase=handle_add_note_validation_failed newNote.trim()=', Boolean(newNote.trim()), 'currentUserId=', Boolean(currentUserId));
      return
    }

    console.log('[LeadDetail] phase=add_note_submitting leadId=', leadId, 'userId=', currentUserId);
    setSubmittingNote(true)
    try {
      const payload = {
        content: newNote,
        userId: currentUserId,
      };
      console.log('[LeadDetail] phase=add_note_fetch_start url=/api/note/', leadId, 'payload=', JSON.stringify(payload));

      const response = await fetch(`/api/note/${leadId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      console.log('[LeadDetail] phase=add_note_response status=', response.status, 'ok=', response.ok);

      const data = await response.json()
      console.log('[LeadDetail] phase=add_note_parsed success=', data.success, 'hasData=', Boolean(data.data), 'error=', data.error);

      if (data.success) {
        console.log('[LeadDetail] phase=add_note_success noteId=', data.data?.id);
        setNotes([data.data, ...notes])
        setNewNote('')
      } else {
        console.error('[LeadDetail] phase=add_note_failed error=', data.error);
      }
    } catch (error) {
      console.error('[LeadDetail] phase=add_note_error leadId=', leadId, 'error=', error instanceof Error ? error.message : String(error), 'stack=', error instanceof Error ? error.stack : undefined);
    } finally {
      setSubmittingNote(false)
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
          {/* Lead Info */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl text-foreground">{lead.name}</CardTitle>
                  <p className="mt-1 text-muted-foreground">{lead.location || '—'}</p>
                </div>
                <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusColors[status]}`}>
                  {status}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-semibold text-foreground">{lead.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-semibold text-foreground">{lead.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Source</p>
                  <p className="font-semibold text-foreground capitalize">{lead.source || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Budget</p>
                  <p className="font-semibold text-foreground">{lead.budget !== null ? lead.budget : '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Assignee</p>
                  <p className="font-semibold text-foreground">
                    {lead.assignee ? lead.assignee.fullName : 'Unassigned'}
                  </p>
                  {lead.assignee && (
                    <span className="text-xs text-muted-foreground">{lead.assignee.email}</span>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-semibold text-foreground">{new Date(lead.created_at).toLocaleString()}</p>
                </div>
              </div>
              {lead.remarks && (
                <div>
                  <p className="text-sm text-muted-foreground">Remarks</p>
                  <p className="font-semibold text-foreground">{lead.remarks}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="notes" className="w-full">
            <TabsList>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="followups">Followups</TabsTrigger>
            </TabsList>

            <TabsContent value="notes" className="space-y-4 mt-6">
              {/* Add Note */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add Note</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder="Add a note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                  />
                  <Button 
                    onClick={handleAddNote} 
                    className="w-full"
                    disabled={!newNote.trim() || submittingNote}
                  >
                    {submittingNote ? 'Adding...' : 'Add Note'}
                  </Button>
                </CardContent>
              </Card>

              {/* Notes List */}
              <div className="space-y-3">
                {notesLoading && (
                  <div className="text-muted-foreground text-sm">Loading notes...</div>
                )}
                {!notesLoading && notes.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <p>No notes yet. Add your first note!</p>
                  </div>
                )}
                {!notesLoading && notes.map((note) => (
                  <Card key={note.id} className="hover:shadow-md transition-shadow duration-200">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        {/* User Avatar */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 dark:from-blue-500 dark:to-blue-700 flex items-center justify-center text-white text-sm font-medium">
                          {note.user.fullName.charAt(0).toUpperCase()}
                        </div>
                        
                        {/* Note Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="font-semibold text-foreground">{note.user.fullName}</p>
                              <p className="text-xs text-muted-foreground">{note.user.email}</p>
                            </div>
                            <p className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                              {new Date(note.createdAt).toLocaleDateString()} {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                            {note.content}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-6">
              <div className="space-y-3">
                {activities.length === 0 && (
                  <div className="text-muted-foreground text-sm">No activity yet.</div>
                )}
                {activities.map((activity) => (
                  <Card key={activity.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{activity.action}</p>
                          <p className="text-sm text-muted-foreground">{activity.description}</p>
                          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{activity.user}</span>
                            <span>{activity.date}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="followups" className="mt-6">
              <div className="space-y-3">
                {followups.length === 0 && (
                  <div className="text-muted-foreground text-sm">No followups yet.</div>
                )}
                {followups.map((followup) => (
                  <Card key={followup.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-foreground">{followup.date}</p>
                          <p className="text-sm capitalize text-muted-foreground">{followup.type}: {followup.note}</p>
                        </div>
                        <span className="rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200">
                          {followup.status}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Action Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assigned To</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold text-foreground">
                {lead.assignee ? lead.assignee.fullName : 'Unassigned'}
              </p>
              {lead.assignee && (
                <span className="text-xs text-muted-foreground">{lead.assignee.email}</span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Change Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="CONTACTED">Contacted</SelectItem>
                  <SelectItem value="FOLLOWUP">Followup</SelectItem>
                  <SelectItem value="VISIT_SCHEDULED">Visit Scheduled</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="CONVERTED">Converted</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full">Update Status</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start gap-2" variant="outline">
                <Plus className="w-4 h-4" />
                Schedule Visit
              </Button>
              <Button className="w-full justify-start gap-2" variant="outline">
                <Plus className="w-4 h-4" />
                Add Followup
              </Button>
              <Button className="w-full justify-start gap-2" variant="outline">
                <Plus className="w-4 h-4" />
                Send Email
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
