'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import dynamic from 'next/dynamic'
import { MapPin, User, TrendingUp, Plus } from 'lucide-react'

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

type VisitTeamUser = {
  id: string
  fullName: string
  email: string
  phone?: string | null
}

interface LeadActionsPanelProps {
  leadId: string
  leadLocation?: string | null
  assignments: Assignment[]
  assignmentsLoading: boolean
  stage: string
  originalStage: string
  subStatus: string | null
  originalSubStatus: string | null
  onStageChange: (value: string) => void
  onSubStatusChange: (value: string | null) => void
  onUpdateStage: (reason: string) => Promise<void>
  onAssignmentsRefresh: () => void
  hasPendingFollowup: boolean
  onAddFollowup: () => void
}

export function LeadActionsPanel({
  leadId,
  leadLocation,
  assignments,
  assignmentsLoading,
  stage,
  originalStage,
  subStatus,
  originalSubStatus,
  onStageChange,
  onSubStatusChange,
  onUpdateStage,
  onAssignmentsRefresh,
  hasPendingFollowup,
  onAddFollowup,
}: LeadActionsPanelProps) {
  const [assignOpen, setAssignOpen] = useState(false)
  const [department, setDepartment] = useState('')
  const [departmentUsers, setDepartmentUsers] = useState<Assignment['user'][]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [reasonOpen, setReasonOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [stageError, setStageError] = useState<string | null>(null)
  const [savingStage, setSavingStage] = useState(false)
  const [visitOpen, setVisitOpen] = useState(false)
  const [visitTeamUsers, setVisitTeamUsers] = useState<VisitTeamUser[]>([])
  const [visitTeamLoading, setVisitTeamLoading] = useState(false)
  const [visitTeamError, setVisitTeamError] = useState<string | null>(null)
  const [visitTeamUserId, setVisitTeamUserId] = useState('')
  const [visitScheduledAt, setVisitScheduledAt] = useState('')
  const [visitLocation, setVisitLocation] = useState('')
  const [visitNotes, setVisitNotes] = useState('')
  const [visitReason, setVisitReason] = useState('')
  const [visitSaving, setVisitSaving] = useState(false)

  const stageSubStatusMap: Record<string, string[]> = useMemo(
    () => ({
      NEW: [],
      CONTACT_ATTEMPTED: ['NUMBER_COLLECTED', 'NO_ANSWER'],
      NURTURING: ['WARM_LEAD', 'FUTURE_CLIENT', 'SMALL_BUDGET'],
      VISIT_SCHEDULED: [],
      CLOSED: ['INVALID', 'NOT_INTERESTED', 'LOST', 'DEAD_LEAD'],
    }),
    [],
  )

  const subStatusOptions = stageSubStatusMap[stage] ?? []
  const requiresSubStatus = subStatusOptions.length > 0
  const hasStageChanged = stage !== originalStage || (subStatus ?? null) !== (originalSubStatus ?? null)
  const canUpdateStage = (!requiresSubStatus || Boolean(subStatus)) && hasStageChanged

  const validDepartments = [
    'ADMIN',
    'SR_CRM',
    'JR_CRM',
    'QUOTATION',
    'VISIT_TEAM',
    'JR_ARCHITECT',
    'VISUALIZER_3D',
  ]

  const DUMMY_LAT = 23.8041425
  const DUMMY_LNG = 90.3700876

  const LeadMapPreview = dynamic(
    () =>
      import('@/components/maps/lead-map-preview').then((mod) => mod.LeadMapPreview),
    { ssr: false },
  )

  const formatLabel = (value: string) => value.replace(/_/g, ' ')
  const visitTeamDepartmentId = process.env.NEXT_PUBLIC_VISIT_TEAM_DEPARTMENT_ID

  useEffect(() => {
    if (!visitOpen) return

    if (!visitLocation && leadLocation) {
      setVisitLocation(leadLocation)
    }

    if (!visitTeamDepartmentId) {
      setVisitTeamError('Visit team department id is not configured.')
      return
    }

    setVisitTeamLoading(true)
    setVisitTeamError(null)

    fetch(`/api/department/${visitTeamDepartmentId}/users`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data?.users)) {
          setVisitTeamUsers(data.data.users)
          return
        }
        throw new Error(data.error || 'Failed to load visit team members.')
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Failed to load visit team members.'
        setVisitTeamError(message)
      })
      .finally(() => {
        setVisitTeamLoading(false)
      })
  }, [leadLocation, visitLocation, visitOpen, visitTeamDepartmentId])

  const handleStageChange = (value: string) => {
    setStageError(null)
    onStageChange(value)
    const nextOptions = stageSubStatusMap[value] ?? []
    if (nextOptions.length === 0) {
      onSubStatusChange(null)
    } else {
      onSubStatusChange('')
    }
  }

  const openReasonDialog = () => {
    setStageError(null)
    if (!canUpdateStage) {
      setStageError('Select a substatus to continue.')
      return
    }
    setReasonOpen(true)
  }

  const handleStageSubmit = async () => {
    if (!reason.trim()) {
      setStageError('Please enter a reason.')
      return
    }

    setSavingStage(true)
    setStageError(null)
    try {
      await onUpdateStage(reason.trim())
      setReasonOpen(false)
      setReason('')
      if (stage === 'VISIT_SCHEDULED') {
        setVisitOpen(true)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update stage.'
      setStageError(message)
    } finally {
      setSavingStage(false)
    }
  }

  const resetVisitForm = () => {
    setVisitTeamUserId('')
    setVisitScheduledAt('')
    setVisitLocation(leadLocation ?? '')
    setVisitNotes('')
    setVisitReason('')
    setVisitTeamError(null)
  }

  const handleVisitOpenChange = (open: boolean) => {
    setVisitOpen(open)
    if (!open) {
      resetVisitForm()
    }
  }

  const handleScheduleVisit = async () => {
    if (!visitTeamUserId) {
      setVisitTeamError('Please select a visit team member.')
      return
    }

    if (!visitScheduledAt) {
      setVisitTeamError('Please choose a visit date and time.')
      return
    }

    if (!visitLocation.trim()) {
      setVisitTeamError('Please provide a visit location.')
      return
    }

    const scheduledIso = new Date(visitScheduledAt).toISOString()

    setVisitSaving(true)
    setVisitTeamError(null)

    try {
      const response = await fetch(`/api/lead/${leadId}/visit-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitTeamUserId,
          scheduledAt: scheduledIso,
          location: visitLocation.trim(),
          notes: visitNotes.trim() || undefined,
          reason: visitReason.trim() || undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to schedule visit.')
      }

      setVisitOpen(false)
      resetVisitForm()
      onStageChange('VISIT_SCHEDULED')
      onSubStatusChange(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to schedule visit.'
      setVisitTeamError(message)
    } finally {
      setVisitSaving(false)
    }
  }

  const handleDepartmentChange = async (value: string) => {
    setDepartment(value)
    setSelectedUserId('')
    setAssignError(null)
    setDepartmentUsers([])

    if (!value) return

    setUsersLoading(true)
    try {
      const response = await fetch(`/api/department/available/${value}`)
      const data = await response.json()
      if (data.success && Array.isArray(data.data?.users)) {
        setDepartmentUsers(data.data.users)
      } else {
        throw new Error(data.error || 'Failed to load users for department.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load users.'
      setAssignError(message)
    } finally {
      setUsersLoading(false)
    }
  }

  const handleAssign = async () => {
    if (!department) {
      setAssignError('Please select a department.')
      return
    }

    if (!selectedUserId) {
      setAssignError('Please select a user.')
      return
    }

    setAssigning(true)
    setAssignError(null)

    try {
      const response = await fetch(`/api/lead/${leadId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          department,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save assignment.')
      }

      setAssignOpen(false)
      setDepartment('')
      setSelectedUserId('')
      setDepartmentUsers([])
      onAssignmentsRefresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save assignment.'
      setAssignError(message)
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Department Assignments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />
            Department Assignments
          </CardTitle>
          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Add assignment">
                <Plus className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add assignment</DialogTitle>
                <DialogDescription>
                  Select a department and assign a user for this lead.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={department} onValueChange={handleDepartmentChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {validDepartments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>User</Label>
                  <Select
                    value={selectedUserId}
                    onValueChange={setSelectedUserId}
                    disabled={!department || usersLoading || departmentUsers.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          usersLoading
                            ? 'Loading users...'
                            : department
                              ? 'Select user'
                              : 'Select department first'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {assignError ? (
                  <p className="text-sm text-destructive">{assignError}</p>
                ) : null}
              </div>
              <DialogFooter>
                <Button
                  onClick={handleAssign}
                  disabled={assigning || !department || !selectedUserId}
                >
                  {assigning ? 'Saving...' : 'Save assignment'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {assignmentsLoading ? (
            <div className="text-center text-muted-foreground text-sm py-4">
              <div className="inline-block w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="mt-2">Loading assignments...</p>
            </div>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assignments yet</p>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="p-3 bg-secondary/50 rounded-lg border border-border">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{assignment.department}</p>
                      <p className="font-semibold text-foreground mt-1 text-sm">{assignment.user.fullName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{assignment.user.email}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Stage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Change Stage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={stage} onValueChange={handleStageChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NEW">New</SelectItem>
              <SelectItem value="CONTACT_ATTEMPTED">Contact Attempted</SelectItem>
              <SelectItem value="NURTURING">Nurturing</SelectItem>
              <SelectItem value="VISIT_SCHEDULED">Visit Scheduled</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>

          {requiresSubStatus ? (
            <Select
              value={subStatus ?? ''}
              onValueChange={(value) => {
                setStageError(null)
                onSubStatusChange(value)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select substatus" />
              </SelectTrigger>
              <SelectContent>
                {subStatusOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {formatLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-xs text-muted-foreground">
              No substatus required for this stage.
            </p>
          )}

          {stageError ? <p className="text-xs text-destructive">{stageError}</p> : null}

          <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
            <Button
              className="w-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
              onClick={openReasonDialog}
              disabled={!canUpdateStage}
            >
              Update Stage
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reason for change</DialogTitle>
                <DialogDescription>
                  Add a short reason for updating the stage/substatus.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Type the reason for this change..."
                  rows={4}
                />
              </div>
              {stageError ? <p className="text-xs text-destructive">{stageError}</p> : null}
              <DialogFooter>
                <Button onClick={handleStageSubmit} disabled={savingStage}>
                  {savingStage ? 'Saving...' : 'Confirm update'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full justify-start gap-2"
            variant="outline"
            onClick={() => setVisitOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Schedule Visit
          </Button>
          <Button
            className="w-full justify-start gap-2"
            variant="outline"
            onClick={onAddFollowup}
            disabled={hasPendingFollowup}
          >
            <Plus className="w-4 h-4" />
            Add Followup
          </Button>
          <Button className="w-full justify-start gap-2" variant="outline">
            <Plus className="w-4 h-4" />
            Send Email
          </Button>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="w-4 h-4" />
              Lead location (dummy)
            </div>
            <LeadMapPreview lat={DUMMY_LAT} lng={DUMMY_LNG} heightClassName="h-36" />
          </div>
        </CardContent>
      </Card>

      <Dialog open={visitOpen} onOpenChange={handleVisitOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule visit</DialogTitle>
            <DialogDescription>
              Assign a visit team member and set the visit details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Visit team member</Label>
              <Select
                value={visitTeamUserId}
                onValueChange={setVisitTeamUserId}
                disabled={visitTeamLoading || visitTeamUsers.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      visitTeamLoading
                        ? 'Loading team...'
                        : visitTeamUsers.length === 0
                          ? 'No visit team members'
                          : 'Select member'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {visitTeamUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Scheduled date & time</Label>
              <Input
                type="datetime-local"
                value={visitScheduledAt}
                onChange={(event) => setVisitScheduledAt(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={visitLocation}
                onChange={(event) => setVisitLocation(event.target.value)}
                placeholder="Visit location"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={visitNotes}
                onChange={(event) => setVisitNotes(event.target.value)}
                placeholder="Optional notes"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={visitReason}
                onChange={(event) => setVisitReason(event.target.value)}
                placeholder="Reason for scheduling this visit"
                rows={3}
              />
            </div>

            {visitTeamError ? (
              <p className="text-sm text-destructive">{visitTeamError}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button onClick={handleScheduleVisit} disabled={visitSaving}>
              {visitSaving ? 'Saving...' : 'Schedule visit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
