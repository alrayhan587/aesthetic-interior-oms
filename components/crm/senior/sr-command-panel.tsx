'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, Crown, Send, UserCheck, Workflow } from 'lucide-react'
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

type LeadMeetingEvent = {
  id: string
  type: 'FIRST_MEETING' | 'BUDGET_MEETING' | 'REVIEW_CHECKPOINT'
  title: string
  startsAt: string
  endsAt: string | null
}

type LeadPhaseTask = {
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
}

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

type LeadSnapshot = {
  id: string
  stage: string
  subStatus: string | null
  location: string | null
  primaryOwner?: LeadPrimaryOwner
  phaseTasks?: LeadPhaseTask[]
  meetingEvents?: LeadMeetingEvent[]
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

function formatPhaseLabel(value: string) {
  return value.replace(/_/g, ' ')
}

export function SrCommandPanel({ lead, currentUserId, onRefreshLead }: SrCommandPanelProps) {
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [firstMeetingOpen, setFirstMeetingOpen] = useState(false)
  const [budgetMeetingOpen, setBudgetMeetingOpen] = useState(false)
  const [srVisitOpen, setSrVisitOpen] = useState(false)

  const [firstMeetingAt, setFirstMeetingAt] = useState(toDateTimeLocalInput(new Date()))
  const [firstMeetingNotes, setFirstMeetingNotes] = useState('')
  const [budgetMeetingAt, setBudgetMeetingAt] = useState(toDateTimeLocalInput(new Date()))
  const [budgetMeetingNotes, setBudgetMeetingNotes] = useState('')

  const [visitMetaLoading, setVisitMetaLoading] = useState(false)
  const [visitAssignees, setVisitAssignees] = useState<VisitAssignee[]>([])
  const [visitAssigneeId, setVisitAssigneeId] = useState('')
  const [visitAt, setVisitAt] = useState(toDateTimeLocalInput(new Date(Date.now() + 60 * 60 * 1000)))
  const [visitLocation, setVisitLocation] = useState(lead.location ?? '')
  const [visitReason, setVisitReason] = useState('Scheduled by Senior CRM for direct client handling.')
  const [visitNotes, setVisitNotes] = useState('')

  const [newTaskPhase, setNewTaskPhase] = useState<'CAD' | 'QUOTATION'>('CAD')
  const [newTaskDueAt, setNewTaskDueAt] = useState(toDateTimeLocalInput(new Date(Date.now() + 24 * 60 * 60 * 1000)))
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState('')

  const [reviewTaskId, setReviewTaskId] = useState('')
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'REWORK'>('APPROVED')
  const [reviewComment, setReviewComment] = useState('')

  const openTasks = useMemo(
    () => (lead.phaseTasks ?? []).filter((task) => task.status !== 'COMPLETED' && task.status !== 'CANCELLED'),
    [lead.phaseTasks],
  )

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

  const selectedReviewTask = openTasks.find((task) => task.id === reviewTaskId) ?? null

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

            <Button variant="outline" className="justify-start gap-2" onClick={() => setFirstMeetingOpen(true)}>
              <CalendarClock className="h-4 w-4" />
              Set First Meeting
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-2"
              disabled={busyAction === 'send-cad'}
              onClick={() =>
                runAction('send-cad', async () => {
                  await patchJson(`/api/lead/${lead.id}/stage`, {
                    stage: 'CAD_PHASE',
                    subStatus: 'CAD_ASSIGNED',
                    reason: 'Sent to CAD by SR CRM command panel.',
                  })
                  toast.success('Lead moved to CAD phase')
                })
              }
            >
              <Send className="h-4 w-4" />
              Send to CAD
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-2"
              disabled={busyAction === 'send-quotation'}
              onClick={() =>
                runAction('send-quotation', async () => {
                  await postJson(`/api/lead/${lead.id}/send-to-quotation`, {
                    reason: 'Manual SR confirmation after first meeting.',
                  })
                  toast.success('Lead sent to quotation team')
                })
              }
            >
              <Send className="h-4 w-4" />
              Send to Quotation
            </Button>

            <Button variant="outline" className="justify-start gap-2" onClick={() => setBudgetMeetingOpen(true)}>
              <CalendarClock className="h-4 w-4" />
              Set Budget Meeting
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-2"
              disabled={busyAction === 'send-visual'}
              onClick={() =>
                runAction('send-visual', async () => {
                  await postJson(`/api/lead/${lead.id}/send-to-visual-accounts`, {
                    reason: 'Budget meeting confirmed. Sent to 3D and Accounts.',
                  })
                  toast.success('Lead sent to 3D + Accounts')
                })
              }
            >
              <Send className="h-4 w-4" />
              Send to 3D + Accounts
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

          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-semibold text-foreground">Phase Deadline</p>
            <div className="grid grid-cols-1 gap-2">
              <Select value={newTaskPhase} onValueChange={(value) => setNewTaskPhase(value as 'CAD' | 'QUOTATION')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="QUOTATION">Quotation</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="datetime-local"
                value={newTaskDueAt}
                onChange={(event) => setNewTaskDueAt(event.target.value)}
              />

              <Input
                placeholder="Optional assignee user id"
                value={newTaskAssigneeId}
                onChange={(event) => setNewTaskAssigneeId(event.target.value)}
              />

              <Button
                size="sm"
                disabled={busyAction === 'create-task'}
                onClick={() =>
                  runAction('create-task', async () => {
                    if (!newTaskDueAt) throw new Error('Task deadline is required')
                    await postJson(`/api/lead/${lead.id}/phase-task`, {
                      phaseType: newTaskPhase,
                      dueAt: new Date(newTaskDueAt).toISOString(),
                      assigneeUserId: newTaskAssigneeId.trim() || undefined,
                    })
                    toast.success(`${newTaskPhase} task created`)
                  })
                }
              >
                Create Phase Task
              </Button>
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-semibold text-foreground">Phase Review</p>
            <Select value={reviewTaskId} onValueChange={setReviewTaskId}>
              <SelectTrigger>
                <SelectValue placeholder="Select active task" />
              </SelectTrigger>
              <SelectContent>
                {openTasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.phaseType} - {formatPhaseLabel(task.status)} - Round {task.currentReviewRound}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={reviewDecision}
              onValueChange={(value) => setReviewDecision(value as 'APPROVED' | 'REWORK')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Decision" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REWORK">Rework</SelectItem>
              </SelectContent>
            </Select>

            <Textarea
              placeholder="Review note"
              rows={3}
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
            />

            <Button
              size="sm"
              disabled={busyAction === 'review-task'}
              onClick={() =>
                runAction('review-task', async () => {
                  if (!selectedReviewTask) throw new Error('Select a task to review')
                  await postJson(`/api/lead/${lead.id}/phase-task/${selectedReviewTask.id}/review`, {
                    decision: reviewDecision,
                    comment: reviewComment.trim() || undefined,
                  })
                  setReviewComment('')
                  toast.success('Review submitted')
                })
              }
            >
              Submit Review Round
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
                  await handleScheduleMeeting('FIRST_MEETING', firstMeetingAt, firstMeetingNotes)
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
                    subStatus: 'BUDGET_MEETING_SET',
                    reason: 'Budget meeting scheduled by SR CRM.',
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
