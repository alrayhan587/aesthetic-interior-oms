'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User, TrendingUp, Plus } from 'lucide-react'

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

interface LeadActionsPanelProps {
  assignments: Assignment[]
  assignmentsLoading: boolean
  stage: string
  onStageChange: (value: string) => void
  onUpdateStage: () => void
}

export function LeadActionsPanel({
  assignments,
  assignmentsLoading,
  stage,
  onStageChange,
  onUpdateStage,
}: LeadActionsPanelProps) {
  return (
    <div className="space-y-4">
      {/* Department Assignments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />
            Department Assignments
          </CardTitle>
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
          <Select value={stage} onValueChange={onStageChange}>
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
          <Button className="w-full" onClick={onUpdateStage}>Update Stage</Button>
        </CardContent>
      </Card>

      {/* Quick Actions */}
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
  )
}
