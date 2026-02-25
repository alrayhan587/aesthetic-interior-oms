'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

// Sample lead data
const leadData = {
  1: {
    id: 1,
    name: 'Acme Corp',
    phone: '+91 9876543210',
    email: 'contact@acmecorp.com',
    location: 'Mumbai',
    project_type: 'Commercial',
    project_size: '50000 sqft',
    status: 'NEW',
    source: 'facebook',
    assigned_to: 'Rajesh Kumar',
    created_at: '2024-02-20',
  },
  2: {
    id: 2,
    name: 'Tech Startup',
    phone: '+91 9876543211',
    email: 'info@techstartup.com',
    location: 'Bangalore',
    project_type: 'Office',
    project_size: '10000 sqft',
    status: 'CONTACTED',
    source: 'manual',
    assigned_to: 'Priya Singh',
    created_at: '2024-02-18',
  },
  3: {
    id: 3,
    name: 'Retail Store',
    phone: '+91 9876543212',
    email: 'store@retail.com',
    location: 'Delhi',
    project_type: 'Retail',
    project_size: '15000 sqft',
    status: 'VISIT_SCHEDULED',
    source: 'referral',
    assigned_to: 'Amit Patel',
    created_at: '2024-02-15',
  },
}

const sampleNotes = [
  { id: 1, author: 'Rajesh Kumar', date: '2024-02-24', content: 'Client prefers modern design with glass elements.' },
  { id: 2, author: 'System', date: '2024-02-23', content: 'Lead created from Facebook leads.' },
]

const sampleActivities = [
  { id: 1, action: 'Status Changed', description: 'Moved to CONTACTED', user: 'Rajesh Kumar', date: '2024-02-24' },
  { id: 2, action: 'Note Added', description: 'Added client preferences', user: 'Rajesh Kumar', date: '2024-02-23' },
  { id: 3, action: 'Lead Created', description: 'New lead added to system', user: 'System', date: '2024-02-20' },
]

const sampleFollowups = [
  { id: 1, date: '2024-02-25', type: 'call', note: 'Follow up on proposal', status: 'pending' },
  { id: 2, date: '2024-02-27', type: 'meeting', note: 'Site visit discussion', status: 'pending' },
]

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const leadId = params.id as string
  const leadIdNum = Number(leadId)
  const lead = leadData[leadIdNum as keyof typeof leadData]
  
  const [status, setStatus] = useState(lead?.status || 'NEW')
  const [newNote, setNewNote] = useState('')

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

  const statusColors: Record<string, string> = {
    NEW: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
    CONTACTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    FOLLOWUP: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
    VISIT_SCHEDULED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
    REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
    CONVERTED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
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
                  <CardTitle className="text-2xl">{lead.name}</CardTitle>
                  <p className="mt-1 text-muted-foreground">{lead.location}</p>
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
                  <p className="font-semibold">{lead.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-semibold">{lead.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Project Type</p>
                  <p className="font-semibold">{lead.project_type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Project Size</p>
                  <p className="font-semibold">{lead.project_size}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Source</p>
                  <p className="font-semibold capitalize">{lead.source}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-semibold">{lead.created_at}</p>
                </div>
              </div>
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
                {sampleNotes.map((note) => (
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
                {sampleActivities.map((activity, idx) => (
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
                {sampleFollowups.map((followup) => (
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
              <p className="font-semibold">{lead.assigned_to}</p>
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
