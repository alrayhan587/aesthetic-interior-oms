'use client'

import { Card, CardContent } from '@/components/ui/card'
import { User, Calendar, TrendingUp, CheckCircle2, AlertCircle, History } from 'lucide-react'

type Activity = {
  id: string
  type: string
  description: string
  createdAt: string
  user: {
    id: string
    fullName: string
    email: string
  }
}

interface LeadActivityTabProps {
  activities: Activity[]
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'USER_ASSIGNED':
      return <User className="w-4 h-4 text-primary" />
    case 'VISIT_SCHEDULED':
      return <Calendar className="w-4 h-4 text-primary" />
    case 'STAGE_CHANGED':
      return <TrendingUp className="w-4 h-4 text-primary" />
    case 'LEAD_CREATED':
      return <CheckCircle2 className="w-4 h-4 text-primary" />
    default:
      return <AlertCircle className="w-4 h-4 text-primary" />
  }
}

export function LeadActivityTab({ activities }: LeadActivityTabProps) {
  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <History className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground text-sm">No activity recorded yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <Card key={activity.id} className="border-border hover:shadow-sm transition-shadow">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 pt-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                  {getActivityIcon(activity.type)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <p className="font-semibold text-foreground text-sm capitalize">{activity.type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground">{activity.user.fullName}</p>
                  </div>
                  <p className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                    {new Date(activity.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{activity.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
