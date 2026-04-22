'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, Loader2, MapPin, Phone, Search, UserRound } from 'lucide-react'
import { toast } from '@/components/ui/sonner'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type LeadRecord = {
  id: string
  name: string
  phone: string | null
  location: string | null
  stage: string
  subStatus: string | null
  updatedAt: string
  budget: number | null
  jrArchitectAssignment: {
    id: string
    user: { id: string; fullName: string; email: string }
  } | null
  srCrmAssignment: {
    id: string
    user: { id: string; fullName: string; email: string }
  } | null
  latestFirstMeeting: {
    id: string
    title: string
    startsAt: string
    notes: string | null
  } | null
  canSetMeeting: boolean
  canSubmitMeetingData: boolean
}

type QueueResponse = {
  success: boolean
  data?: LeadRecord[]
  error?: string
}

type DepartmentUser = { id: string; fullName: string; email: string }

function formatLabel(value: string | null | undefined) {
  if (!value) return 'N/A'
  if (value === 'DISCOVERY') return 'Consulting Phase'
  if (value === 'PROPOSAL_SENT') return 'Quotation Sent'
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function toDateTimeLocalInput(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

export function CadPhaseQueueBoard({
  title,
  subtitle,
  leadBasePath,
  cadApprovedOnly = false,
}: {
  title: string
  subtitle: string
  leadBasePath: string
  cadApprovedOnly?: boolean
}) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [memberOptions, setMemberOptions] = useState<DepartmentUser[]>([])
  const [activeLead, setActiveLead] = useState<LeadRecord | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [reassignOpen, setReassignOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [meetingOpen, setMeetingOpen] = useState(false)
  const [meetingAt, setMeetingAt] = useState(toDateTimeLocalInput(new Date()))
  const [meetingMode, setMeetingMode] = useState<'ONLINE' | 'OFFLINE'>('ONLINE')
  const [meetingNote, setMeetingNote] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        cadApprovedOnly: cadApprovedOnly ? '1' : '0',
      })
      if (search) params.set('search', search)
      const response = await fetch(`/api/cad-work/jr-architect-queue?${params.toString()}`, { cache: 'no-store' })
      const payload = (await response.json()) as QueueResponse
      if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
        throw new Error(payload.error ?? 'Failed to load queue')
      }
      setLeads(payload.data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load queue')
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [cadApprovedOnly, search])

  useEffect(() => {
    void loadLeads()
  }, [loadLeads])

  const loadJrArchitectMembers = async () => {
    if (memberOptions.length > 0) return
    const response = await fetch('/api/department/available/JR_ARCHITECT', { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error ?? 'Failed to load JR Architect members')
    }
    const users = Array.isArray(payload.users) ? payload.users : []
    setMemberOptions(users)
  }

  const openReassign = async (lead: LeadRecord) => {
    setActiveLead(lead)
    setSelectedMemberId(lead.jrArchitectAssignment?.user.id ?? '')
    setReassignOpen(true)
    try {
      await loadJrArchitectMembers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load JR Architect members')
    }
  }

  const submitReassign = async () => {
    if (!activeLead || !selectedMemberId) return
    setSaving(true)
    try {
      const response = await fetch(`/api/lead/${activeLead.id}/assignments/JR_ARCHITECT`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedMemberId }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) throw new Error(payload?.error ?? 'Failed to reassign JR Architect')
      toast.success('JR Architect reassigned successfully')
      setReassignOpen(false)
      setActiveLead(null)
      await loadLeads()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reassign JR Architect')
    } finally {
      setSaving(false)
    }
  }

  const openFirstMeetingDialog = (lead: LeadRecord) => {
    setActiveLead(lead)
    setMeetingAt(toDateTimeLocalInput(new Date()))
    setMeetingMode('ONLINE')
    setMeetingNote('')
    setMeetingOpen(true)
  }

  const submitFirstMeeting = async () => {
    if (!activeLead) return
    setSaving(true)
    try {
      const startsAt = new Date(meetingAt)
      if (Number.isNaN(startsAt.getTime())) throw new Error('Valid meeting date/time is required')
      const startsAtIso = startsAt.toISOString()
      const notes = [`Meeting mode: ${meetingMode}`, meetingNote.trim()].filter(Boolean).join('\n')

      const meetingRes = await fetch(`/api/lead/${activeLead.id}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'FIRST_MEETING',
          startsAt: startsAtIso,
          notes: notes || null,
        }),
      })
      const meetingPayload = await meetingRes.json()
      if (!meetingRes.ok || !meetingPayload?.success) {
        throw new Error(meetingPayload?.error ?? 'Failed to schedule first meeting')
      }

      const stageRes = await fetch(`/api/lead/${activeLead.id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'DISCOVERY',
          subStatus: 'FIRST_MEETING_SET',
          reason: 'First meeting scheduled from Meeting Queue.',
        }),
      })
      const stagePayload = await stageRes.json()
      if (!stageRes.ok || !stagePayload?.success) {
        throw new Error(stagePayload?.error ?? 'Meeting saved, but stage update failed')
      }

      toast.success('First meeting created and added to calendar')
      setMeetingOpen(false)
      setActiveLead(null)
      await loadLeads()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to schedule first meeting')
    } finally {
      setSaving(false)
    }
  }

  const summary = useMemo(() => {
    const cadApproved = leads.filter((lead) => lead.subStatus === 'CAD_APPROVED').length
    const meetingSet = leads.filter((lead) => lead.subStatus === 'FIRST_MEETING_SET').length
    return { total: leads.length, cadApproved, meetingSet }
  }, [leads])

  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader title={title} subtitle={subtitle} />

      <main className="mx-auto max-w-[1440px] px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by lead name, phone, or location..."
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="h-8 px-3">
              Total: {summary.total}
            </Badge>
            <Badge variant="secondary" className="h-8 px-3">
              CAD Approved: {summary.cadApproved}
            </Badge>
            {cadApprovedOnly ? (
              <Badge variant="secondary" className="h-8 px-3">
                Meeting Set: {summary.meetingSet}
              </Badge>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-lg border border-border bg-card py-14">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : leads.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">No leads found.</CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <Card key={lead.id} className="overflow-hidden border-border/70 shadow-sm transition hover:border-primary/40 hover:shadow-md">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <Link href={`${leadBasePath}/${lead.id}`} className="text-base font-semibold hover:text-primary hover:underline">
                        {lead.name}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{formatLabel(lead.stage)}</Badge>
                        <Badge variant="outline">{formatLabel(lead.subStatus)}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`${leadBasePath}/${lead.id}`}>Open Lead</Link>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openReassign(lead)}>
                        Reassign JR Architect
                      </Button>
                      {cadApprovedOnly ? (
                        lead.canSetMeeting ? (
                          <Button size="sm" onClick={() => openFirstMeetingDialog(lead)}>
                            <CalendarClock className="mr-1 h-4 w-4" />
                            Set Meeting
                          </Button>
                        ) : lead.canSubmitMeetingData ? (
                          <Button asChild size="sm">
                            <Link href={`${leadBasePath}/${lead.id}`}>
                              <CalendarClock className="mr-1 h-4 w-4" />
                              Submit Meeting Data
                            </Link>
                          </Button>
                        ) : null
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                    <p className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {lead.phone || 'No phone'}
                    </p>
                    <p className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {lead.location || 'No location'}
                    </p>
                    <p className="inline-flex items-center gap-1">
                      <UserRound className="h-3.5 w-3.5" />
                      JR Architect: {lead.jrArchitectAssignment?.user.fullName ?? 'Unassigned'}
                    </p>
                    <p className="inline-flex items-center gap-1">
                      <UserRound className="h-3.5 w-3.5" />
                      SR CRM: {lead.srCrmAssignment?.user.fullName ?? 'Unassigned'}
                    </p>
                    {cadApprovedOnly && lead.latestFirstMeeting ? (
                      <p className="inline-flex items-center gap-1 md:col-span-2">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Latest First Meeting: {new Date(lead.latestFirstMeeting.startsAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign JR Architect</DialogTitle>
            <DialogDescription>Select a new JR Architect for this CAD lead.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>JR Architect Member</Label>
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {memberOptions.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button disabled={saving || !selectedMemberId} onClick={submitReassign}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={meetingOpen} onOpenChange={setMeetingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set First Meeting</DialogTitle>
            <DialogDescription>Creates first meeting and adds it to the Senior CRM calendar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Date & Time</Label>
              <Input type="datetime-local" value={meetingAt} onChange={(event) => setMeetingAt(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Meeting Type</Label>
              <Select value={meetingMode} onValueChange={(value) => setMeetingMode(value as 'ONLINE' | 'OFFLINE')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ONLINE">Online</SelectItem>
                  <SelectItem value="OFFLINE">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea rows={3} value={meetingNote} onChange={(event) => setMeetingNote(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={saving || !meetingAt} onClick={submitFirstMeeting}>
              Submit Meeting Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
