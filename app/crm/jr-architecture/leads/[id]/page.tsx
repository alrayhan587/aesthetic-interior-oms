'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, MessageSquare, MapPin, FileText, ImageIcon, Video, Home } from 'lucide-react'
import { LeadNotesTab } from '@/components/crm/junior/lead-notes-tab'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fetchMeCached } from '@/lib/client-me'

// Minimal interfaces for rendering
type LeadAttachment = {
  id: string
  url: string
  fileName: string
  fileType: string
  category: string
  sizeBytes: number | null
  createdAt: string
}

type VisitResult = {
  summary: string
  measurements: any
  clientPotentiality: string | null
  budgetRange: string | null
  stylePreference: string | null
}

type Visit = {
  id: string
  scheduledAt: string
  projectSqft: number | null
  projectStatus: string | null
  result?: VisitResult | null
}

export default function JrArcLeadDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const leadId = params.id as string

  const [lead, setLead] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<any[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [newNote, setNewNote] = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const [activeTab, setActiveTab] = useState('attachments')
  const [stage, setStage] = useState('CAD_PHASE')
  const [subStatus, setSubStatus] = useState<string | null>(null)
  const [updatingStage, setUpdatingStage] = useState(false)

  useEffect(() => {
    fetchMeCached().then(data => {
      if (data?.id) setCurrentUserId(data.id)
    })
  }, [])

  const refreshLeadDetails = useCallback(() => {
    setLoading(true)
    fetch(`/api/lead/${leadId}?includeVisits=true&includeAttachments=true`)
      .then(res => res.json())
      .then(data => {
        setLead(data.data)
        setStage(data.data?.stage || 'CAD_PHASE')
        setSubStatus(data.data?.subStatus || 'CAD_WORKING')
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error fetching lead:', error)
        setLoading(false)
      })
  }, [leadId])

  useEffect(() => {
    refreshLeadDetails()
  }, [refreshLeadDetails])

  useEffect(() => {
    if (activeTab === 'notes') {
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
    }
  }, [leadId, activeTab])

  const handleAddNote = async () => {
    if (!newNote.trim() || !currentUserId) return
    setSubmittingNote(true)
    try {
      const response = await fetch(`/api/note/${leadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote, userId: currentUserId }),
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

  const handleStageUpdate = async (newStage: string, newSubStatus: string) => {
    setUpdatingStage(true)
    try {
      const response = await fetch(`/api/lead/${leadId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: newStage,
          subStatus: newSubStatus,
          reason: `Stage changed via CAD interface`,
          userId: currentUserId,
        }),
      })
      const data = await response.json()
      if (data.success) {
        setStage(newStage)
        setSubStatus(newSubStatus)
      }
    } catch (error) {
      console.error('Error updating status:', error)
    } finally {
      setUpdatingStage(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 animate-pulse space-y-4">
        <div className="h-10 w-24 bg-muted rounded" />
        <div className="h-32 bg-muted rounded-xl" />
        <div className="h-64 bg-muted rounded-xl" />
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="p-4 sm:p-6">
        <Button onClick={() => router.back()} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <p className="mt-4 text-muted-foreground">Lead not found</p>
      </div>
    )
  }

  const visit: Visit | undefined = lead.visits?.[0]
  const attachments: LeadAttachment[] = lead.attachments || []
  const mediaAttachments = attachments.filter((item) => item.category === 'MEDIA')
  const fileAttachments = attachments.filter((item) => item.category !== 'MEDIA')

  const formatSize = (sizeBytes: number | null) => {
    if (!sizeBytes || sizeBytes <= 0) return 'Unknown size'
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-3 sm:p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <Button onClick={() => router.back()} variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to List
          </Button>
        </div>

        {/* Lead Identity Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h1 className="text-2xl font-bold text-foreground">{lead.name}</h1>
              <div className="mt-4 flex flex-col gap-3 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{lead.location || 'No location provided'}</span>
                </div>
              </div>
            </div>

            {/* Stage Selector Box */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-sm font-semibold mb-3">CAD Sub-Status Update</h3>
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <Label className="mb-2 block">Current Process Status</Label>
                  <Select
                    value={subStatus || 'CAD_WORKING'}
                    onValueChange={(val) => handleStageUpdate('CAD_PHASE', val)}
                    disabled={updatingStage}
                  >
                    <SelectTrigger className="w-full bg-secondary/30">
                      <SelectValue placeholder="Update status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CAD_ASSIGNED">CAD Assigned</SelectItem>
                      <SelectItem value="CAD_WORKING">CAD In Progress</SelectItem>
                      <SelectItem value="CAD_COMPLETED">CAD Completed</SelectItem>
                      <SelectItem value="CAD_APPROVED">CAD Approved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Operations Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid h-12 w-full grid-cols-3 rounded-lg bg-muted p-1 text-muted-foreground">
                <TabsTrigger value="attachments" className="flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" /> Attachments
                </TabsTrigger>
                <TabsTrigger value="notes" className="flex items-center justify-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Notes
                </TabsTrigger>
                <TabsTrigger value="visit" className="flex items-center justify-center gap-2">
                  <Home className="w-4 h-4" /> Visit Details
                </TabsTrigger>
              </TabsList>

              <TabsContent value="attachments" className="mt-4">
                <div className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
                  {attachments.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
                      <ImageIcon className="mx-auto w-8 h-8 mb-2 opacity-50" />
                      <p>No attachments uploaded by the team yet.</p>
                    </div>
                  ) : (
                    <>
                      {mediaAttachments.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-foreground mb-3">Images & Media</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {mediaAttachments.map((item) => (
                              <a
                                key={item.id}
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between rounded-md border border-border px-3 py-3 hover:bg-secondary/40 transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {item.fileType.startsWith('video/') ? (
                                    <Video className="h-5 w-5 shrink-0 text-primary" />
                                  ) : (
                                    <ImageIcon className="h-5 w-5 shrink-0 text-primary" />
                                  )}
                                  <span className="truncate text-sm text-foreground font-medium">{item.fileName}</span>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {fileAttachments.length > 0 && (
                        <div className="mt-6">
                          <h3 className="text-sm font-semibold text-foreground mb-3">Documents</h3>
                          <div className="space-y-2">
                            {fileAttachments.map((item) => (
                              <a
                                key={item.id}
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between rounded-md border border-border px-4 py-3 hover:bg-secondary/40 transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                                  <span className="truncate text-sm font-medium">{item.fileName}</span>
                                </div>
                                <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                                  {formatSize(item.sizeBytes)}
                                </span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                <LeadNotesTab
                  notes={notes}
                  notesLoading={notesLoading}
                  newNote={newNote}
                  submittingNote={submittingNote}
                  onNoteChange={setNewNote}
                  onAddNote={handleAddNote}
                />
              </TabsContent>

              <TabsContent value="visit" className="mt-4">
                {!visit ? (
                  <div className="py-12 bg-card rounded-xl border border-border text-center text-muted-foreground">
                    <p>No site visits have been logged for this lead yet.</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Visit Meta</h3>
                      <div className="grid grid-cols-2 gap-4 bg-secondary/20 p-4 rounded-lg">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Scheduled At</p>
                          <p className="font-medium">{new Date(visit.scheduledAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Sqft</p>
                          <p className="font-medium">{visit.projectSqft || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Site Status</p>
                          <p className="font-medium">{visit.projectStatus?.replace(/_/g, ' ') || 'Unknown'}</p>
                        </div>
                      </div>
                    </div>

                    {visit.result && (
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Result Data</h3>
                        <div className="bg-secondary/20 p-4 rounded-lg space-y-4">
                          {visit.result.summary && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Summary</p>
                              <p className="text-sm leading-relaxed">{visit.result.summary}</p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                            {visit.result.budgetRange && (
                              <div>
                                <p className="text-xs text-muted-foreground">Budget Expectation</p>
                                <p className="font-medium text-sm">{visit.result.budgetRange}</p>
                              </div>
                            )}
                            {visit.result.stylePreference && (
                              <div>
                                <p className="text-xs text-muted-foreground">Style Preference</p>
                                <p className="font-medium text-sm">{visit.result.stylePreference}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className="md:col-span-1 border-l border-border pl-0 md:pl-6 pt-6 md:pt-0">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground">Workspace Info</h3>
            <p className="text-sm text-muted-foreground mb-6">
              You are viewing the architectural layout phase of a lead. Coordinate through the Notes tab. Change status below when tasks progress.
            </p>
            <div className="bg-primary/5 p-4 rounded-xl border border-primary/20">
              <h4 className="text-sm font-semibold text-primary mb-2">Notice</h4>
              <p className="text-xs text-foreground/80">
                Please upload any generated 2D/3D layouts explicitly to your cloud drive, and utilize the Notes area to link those drives or communicate directly with the team. Avoid leaving large design files natively via normal attachments.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
