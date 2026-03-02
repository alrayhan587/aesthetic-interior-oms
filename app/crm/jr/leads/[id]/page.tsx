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
  id: string | number
  author: string
  date: string
  content: string
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
  const [status, setStatus] = useState('NEW')
  const [newNote, setNewNote] = useState('')

  // These will be replaced with real API data in the future
  const [notes, setNotes] = useState<Note[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [followups, setFollowups] = useState<Followup[]>([])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/lead/${leadId}`)
      .then(res => res.json())
      .then(data => {
        setLead(data.data)
        setStatus(data.data?.status || 'NEW')
        // If your API returns notes, activities, followups, set them here
        setNotes(data.data?.notes || [])
        setActivities(data.data?.activities || [])
        setFollowups(data.data?.followUps || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [leadId])

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
                  <Button className="w-full">Add Note</Button>
                </CardContent>
              </Card>

              {/* Notes List */}
              <div className="space-y-3">
                {notes.length === 0 && (
                  <div className="text-muted-foreground text-sm">No notes yet.</div>
                )}
                {notes.map((note) => (
                  <Card key={note.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-semibold text-foreground">{note.author}</p>
                        <p className="text-xs text-muted-foreground">{note.date}</p>
                      </div>
                      <p className="text-muted-foreground">{note.content}</p>
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
