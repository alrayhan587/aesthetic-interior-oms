'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, User, AlertCircle } from 'lucide-react'

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

interface LeadFollowupsTabProps {
  followups: Followup[]
}

export function LeadFollowupsTab({ followups }: LeadFollowupsTabProps) {
  if (followups.length === 0) {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground text-sm">No followups scheduled.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {followups.map((followup) => (
        <Card key={followup.id} className="border-border hover:shadow-sm transition-shadow">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <p className="font-semibold text-foreground">
                    {new Date(followup.followupDate).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{followup.notes}</p>
                <div className="flex items-center gap-2 text-xs">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{followup.assignedTo.fullName}</span>
                </div>
              </div>
              <Badge className={followup.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'}>
                {followup.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
