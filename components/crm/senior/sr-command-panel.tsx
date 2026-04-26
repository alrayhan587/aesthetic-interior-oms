'use client'

import { useState } from 'react'
import { CalendarClock, Crown, UserCheck, Workflow } from 'lucide-react'
import { toast } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
} from '@/components/ui/dialog'

type LeadPrimaryOwner = {
  id: string
  fullName: string
  email: string
} | null

type VisitAssignee = {
  id: string
  fullName: string
  email: string
  phone?: string | null
}

type VisitScheduleMetaResponse = {
  success: boolean
  data?: {
    defaultLocation: string | null
    visitAssigneeMembers?: VisitAssignee[]
    visitTeamMembers?: VisitAssignee[]
  }
  error?: string
}

type DepartmentUsersResponse = {
  success: boolean
  users?: VisitAssignee[]
  error?: string
}

type LeadSnapshot = {
  id: string
  stage: string
  subStatus: string | null
  location: string | null
  primaryOwner?: LeadPrimaryOwner
}

type SrCommandPanelProps = {
  lead: LeadSnapshot
  currentUserId: string | null
  onRefreshLead: () => void
}

function toDateTimeLocalInput(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

export function SrCommandPanel({ lead, currentUserId, onRefreshLead }: SrCommandPanelProps) {
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [firstMeetingOpen, setFirstMeetingOpen] = useState(false)
  const [completeFirstMeetingOpen, setCompleteFirstMeetingOpen] = useState(false)
  const [budgetMeetingOpen, setBudgetMeetingOpen] = useState(false)
  const [srVisitOpen, setSrVisitOpen] = useState(false)

  const [firstMeetingAt, setFirstMeetingAt] = useState(toDateTimeLocalInput(new Date()))
  const [firstMeetingSummary, setFirstMeetingSummary] = useState('')
  const [firstMeetingNotes, setFirstMeetingNotes] = useState('')
  const [meetingOptions, setMeetingOptions] = useState<Array<{ title: string; details: string }>>([
    { title: '', details: '' },
  ])
  const [quotationMembers, setQuotationMembers] = useState<VisitAssignee[]>([])
  const [loadingQuotationMembers, setLoadingQuotationMembers] = useState(false)
  const [selectedQuotationMemberId, setSelectedQuotationMemberId] = useState('')
  const [completeFirstMeetingNote, setCompleteFirstMeetingNote] = useState('')
  const [budgetMeetingAt, setBudgetMeetingAt] = useState(toDateTimeLocalInput(new Date()))
  const [budgetMeetingNotes, setBudgetMeetingNotes] = useState('')

  const [visitMetaLoading, setVisitMetaLoading] = useState(false)
  const [visitAssignees, setVisitAssignees] = useState<VisitAssignee[]>([])
  const [visitAssigneeId, setVisitAssigneeId] = useState('')
  const [visitAt, setVisitAt] = useState(toDateTimeLocalInput(new Date(Date.now() + 60 * 60 * 1000)))
  const [visitLocation, setVisitLocation] = useState(lead.location ?? '')
  const [visitReason, setVisitReason] = useState('Scheduled by Senior CRM for direct client handling.')
  const [visitNotes, setVisitNotes] = useState('')

  const runAction = async (key: string, action: () => Promise<void>) => {
    setBusyAction(key)
    try {
      await action()
      onRefreshLead()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed')
    } finally {
      setBusyAction(null)
    }
  }

  const postJson = async (url: string, body: Record<string, unknown>) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = (await response.json()) as { success?: boolean; error?: string }
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? 'Request failed')
    }
  }

  const patchJson = async (url: string, body: Record<string, unknown>) => {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = (await response.json()) as { success?: boolean; error?: string }
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? 'Request failed')
    }
  }

  const handleScheduleMeeting = async (
    type: 'FIRST_MEETING' | 'BUDGET_MEETING',
    startsAt: string,
    notes: string,
  ) => {
    if (!startsAt) throw new Error('Meeting time is required')

    await postJson(`/api/lead/${lead.id}/meetings`, {
      type,
      startsAt: new Date(startsAt).toISOString(),
      notes: notes.trim() || null,
    })

    toast.success(type === 'FIRST_MEETING' ? 'First meeting scheduled' : 'Budget meeting scheduled')
  }

  const loadVisitMeta = async () => {
    setVisitMetaLoading(true)
    try {
      const response = await fetch(`/api/lead/${lead.id}/visit-schedule`, { cache: 'no-store' })
      const payload = (await response.json()) as VisitScheduleMetaResponse
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Failed to load visit assignees')
      }

      const members = payload.data.visitAssigneeMembers ?? payload.data.visitTeamMembers ?? []
      setVisitAssignees(members)
      setVisitLocation(payload.data.defaultLocation ?? lead.location ?? '')

      if (currentUserId && members.some((member) => member.id === currentUserId)) {
        setVisitAssigneeId(currentUserId)
      } else if (members.length > 0) {
        setVisitAssigneeId(members[0].id)
      } else {
        setVisitAssigneeId('')
      }
    } finally {
      setVisitMetaLoading(false)
    }
  }

  const loadQuotationMembers = async () => {
    if (quotationMembers.length > 0) return
    setLoadingQuotationMembers(true)
    try {
      const response = await fetch('/api/department/available/QUOTATION', { cache: 'no-store' })
      const payload = (await response.json()) as DepartmentUsersResponse
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Failed to load quotation members')
      }
      const members = Array.isArray(payload.users) ? payload.users : []
      setQuotationMembers(members)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load quotation members')
    } finally {
      setLoadingQuotationMembers(false)
    }
  }

  const canCompleteFirstMeeting = lead.stage === 'DISCOVERY' && lead.subStatus === 'FIRST_MEETING_SET'

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Workflow className="h-4 w-4" />
            SR Command Panel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Primary Owner</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{lead.primaryOwner?.fullName ?? 'Not set'}</p>
                <p className="text-xs text-muted-foreground">{lead.primaryOwner?.email ?? 'No primary owner assigned'}</p>
              </div>
              <Badge variant="secondary" className="whitespace-nowrap">
                {lead.primaryOwner?.id === currentUserId ? 'You' : 'Assigned'}
              </Badge>
            </div>
          </div>

          <div className="grid gap-2">
            <Button
              variant="outline"
              className="justify-start gap-2"
              disabled={busyAction === 'takeover'}
              onClick={() =>
                runAction('takeover', async () => {
                  await postJson(`/api/lead/${lead.id}/takeover`, {
                    reason: 'Senior CRM took over as primary owner.',
                  })
                  toast.success('You are now primary owner')
                })
              }
            >
              <Crown className="h-4 w-4" />
              Take Over as Primary
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => setFirstMeetingOpen(true)}
            >
              <CalendarClock className="h-4 w-4" />
              Set First Meeting
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-2"
              disabled={!canCompleteFirstMeeting}
              onClick={async () => {
                await loadQuotationMembers()
                setSelectedQuotationMemberId('')
                setCompleteFirstMeetingNote('')
                setCompleteFirstMeetingOpen(true)
              }}
            >
              <CalendarClock className="h-4 w-4" />
              Complete First Meeting
            </Button>

            <Button variant="outline" className="justify-start gap-2" onClick={() => setBudgetMeetingOpen(true)}>
              <CalendarClock className="h-4 w-4" />
              Set Budget Meeting
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={async () => {
                await loadVisitMeta()
                setSrVisitOpen(true)
              }}
            >
              <UserCheck className="h-4 w-4" />
              Schedule SR Visit
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={firstMeetingOpen} onOpenChange={setFirstMeetingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set First Meeting</DialogTitle>
            <DialogDescription>Schedule the first client meeting for this lead.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Meeting Time</Label>
              <Input
                type="datetime-local"
                value={firstMeetingAt}
                onChange={(event) => setFirstMeetingAt(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Meeting Summary</Label>
              <Input
                value={firstMeetingSummary}
                onChange={(event) => setFirstMeetingSummary(event.target.value)}
                placeholder="e.g. Nice client"
              />
            </div>
            <div className="space-y-2">
              <Label>Meeting Options</Label>
              {meetingOptions.map((option, index) => (
                <div key={index} className="grid gap-2 rounded-md border p-2 md:grid-cols-2">
                  <Input
                    placeholder={`Option ${index + 1} title`}
                    value={option.title}
                    onChange={(event) =>
                      setMeetingOptions((prev) =>
                        prev.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, title: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Input
                    placeholder={`Option ${index + 1} details`}
                    value={option.details}
                    onChange={(event) =>
                      setMeetingOptions((prev) =>
                        prev.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, details: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMeetingOptions((prev) => [...prev, { title: '', details: '' }])}
              >
                Add Option
              </Button>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={firstMeetingNotes}
                onChange={(event) => setFirstMeetingNotes(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={busyAction === 'first-meeting'}
              onClick={() =>
                runAction('first-meeting', async () => {
                  const optionLines = meetingOptions
                    .map((option) => ({
                      title: option.title.trim(),
                      details: option.details.trim(),
                    }))
                    .filter((option) => option.title || option.details)
                    .map((option, index) => `Option ${index + 1}: ${option.title} -> ${option.details}`)

                  const compiledNotes = [
                    `Meeting Summary: ${firstMeetingSummary.trim() || 'N/A'}`,
                    optionLines.length > 0 ? `Meeting Notes:\n${optionLines.join('\n')}` : null,
                    firstMeetingNotes.trim() ? `Additional Notes: ${firstMeetingNotes.trim()}` : null,
                  ]
                    .filter(Boolean)
                    .join('\n\n')

                  await handleScheduleMeeting('FIRST_MEETING', firstMeetingAt, compiledNotes)

                  setFirstMeetingOpen(false)
                  await patchJson(`/api/lead/${lead.id}/stage`, {
                    stage: 'DISCOVERY',
                    subStatus: 'FIRST_MEETING_SET',
                    reason: 'First meeting scheduled by SR CRM.',
                  })
                })
              }
            >
              Save Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completeFirstMeetingOpen} onOpenChange={setCompleteFirstMeetingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete First Meeting</DialogTitle>
            <DialogDescription>
              Complete first meeting and optionally assign a quotation member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Assign quotation member (optional)</Label>
              <Select value={selectedQuotationMemberId} onValueChange={setSelectedQuotationMemberId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingQuotationMembers
                        ? 'Loading members...'
                        : quotationMembers.length === 0
                          ? 'No quotation members available'
                          : 'Select quotation member'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {quotationMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Note</Label>
              <Textarea
                rows={3}
                value={completeFirstMeetingNote}
                onChange={(event) => setCompleteFirstMeetingNote(event.target.value)}
                placeholder="Optional meeting completion note..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={busyAction === 'complete-first-meeting'}
              onClick={() =>
                runAction('complete-first-meeting', async () => {
                  await postJson(`/api/lead/${lead.id}/meetings/complete`, {
                    note: completeFirstMeetingNote.trim() || null,
                    quotationMemberId: selectedQuotationMemberId || null,
                  })
                  setCompleteFirstMeetingOpen(false)
                  toast.success('First meeting completed')
                })
              }
            >
              Complete Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={budgetMeetingOpen} onOpenChange={setBudgetMeetingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Budget Meeting</DialogTitle>
            <DialogDescription>Schedule the budget discussion meeting with client.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Meeting Time</Label>
              <Input
                type="datetime-local"
                value={budgetMeetingAt}
                onChange={(event) => setBudgetMeetingAt(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={budgetMeetingNotes}
                onChange={(event) => setBudgetMeetingNotes(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={busyAction === 'budget-meeting'}
              onClick={() =>
                runAction('budget-meeting', async () => {
                  await handleScheduleMeeting('BUDGET_MEETING', budgetMeetingAt, budgetMeetingNotes)
                  setBudgetMeetingOpen(false)
                  await patchJson(`/api/lead/${lead.id}/stage`, {
                    stage: 'BUDGET_PHASE',
                    subStatus: 'PROPOSAL_SENT',
                    reason: 'Budget meeting scheduled by SR CRM and quotation sent.',
                  })
                })
              }
            >
              Save Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={srVisitOpen} onOpenChange={setSrVisitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule SR Visit</DialogTitle>
            <DialogDescription>
              Assign a visit directly to Senior CRM or visit team for important client handling.
            </DialogDescription>
          </DialogHeader>

          {visitMetaLoading ? (
            <p className="text-sm text-muted-foreground">Loading visit assignees...</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Visit Assignee</Label>
                <Select value={visitAssigneeId} onValueChange={setVisitAssigneeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {visitAssignees.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Visit Time</Label>
                <Input type="datetime-local" value={visitAt} onChange={(event) => setVisitAt(event.target.value)} />
              </div>

              <div className="space-y-1">
                <Label>Location</Label>
                <Input value={visitLocation} onChange={(event) => setVisitLocation(event.target.value)} />
              </div>

              <div className="space-y-1">
                <Label>Reason</Label>
                <Input value={visitReason} onChange={(event) => setVisitReason(event.target.value)} />
              </div>

              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea rows={3} value={visitNotes} onChange={(event) => setVisitNotes(event.target.value)} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              disabled={busyAction === 'schedule-sr-visit' || visitMetaLoading}
              onClick={() =>
                runAction('schedule-sr-visit', async () => {
                  if (!visitAssigneeId) throw new Error('Visit assignee is required')
                  if (!visitAt) throw new Error('Visit time is required')
                  if (!visitLocation.trim()) throw new Error('Visit location is required')

                  await postJson(`/api/lead/${lead.id}/visit-schedule`, {
                    visitTeamUserId: visitAssigneeId,
                    scheduledAt: new Date(visitAt).toISOString(),
                    location: visitLocation.trim(),
                    reason: visitReason.trim() || undefined,
                    notes: visitNotes.trim() || undefined,
                  })

                  setSrVisitOpen(false)
                  toast.success('Visit scheduled successfully')
                })
              }
            >
              Schedule Visit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
