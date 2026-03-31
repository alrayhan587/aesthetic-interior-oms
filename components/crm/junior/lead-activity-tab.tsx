'use client'

import {
  User,
  Calendar,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  History,
  Flag,
} from 'lucide-react'

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

const formatTypeLabel = (type: string) => type.replace(/_/g, ' ')

const isVisitCompletedActivity = (activity: Activity) => {
  const normalizedType = activity.type.trim().toUpperCase()
  const normalizedDescription = activity.description.trim().toUpperCase()
  return (
    normalizedType === 'VISIT_COMPLETED' ||
    normalizedDescription.includes('VISIT COMPLETED') ||
    normalizedDescription.includes('VISIT_COMPLETED') ||
    normalizedDescription.includes('TO VISIT_COMPLETED')
  )
}

const isImportantBreakpoint = (activity: Activity) => {
  const normalizedType = activity.type.trim().toUpperCase()
  return (
    normalizedType === 'LEAD_CREATED' ||
    normalizedType === 'VISIT_SCHEDULED' ||
    isVisitCompletedActivity(activity)
  )
}

const getImportantTitle = (activity: Activity) => {
  const normalizedType = activity.type.trim().toUpperCase()
  if (normalizedType === 'LEAD_CREATED') return 'Lead Created'
  if (normalizedType === 'VISIT_SCHEDULED') return 'Visit Scheduled'
  if (isVisitCompletedActivity(activity)) return 'Visit Completed'
  return formatTypeLabel(activity.type)
}

export function LeadActivityTab({ activities }: LeadActivityTabProps) {
  if (activities.length === 0) {
    return (
      <div className="py-8 text-center">
        <History className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-7">
        {activities.map((activity, index) => {
          const important = isImportantBreakpoint(activity)
          const isLast = index === activities.length - 1

          return (
            <div key={activity.id} className="relative pl-10">
              {!isLast ? (
                <div className="absolute left-[15px] top-8 h-[calc(100%+20px)] w-px bg-border/80" />
              ) : null}

              <div
                className={`absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full border ${
                  important
                    ? 'border-primary/35 bg-primary/10 text-primary'
                    : 'border-border/90 bg-secondary/70 text-muted-foreground'
                }`}
              >
                {important ? <Flag className="h-4 w-4" /> : getActivityIcon(activity.type)}
              </div>

              {important ? (
                <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-2xl font-bold tracking-tight text-foreground">
                        {getImportantTitle(activity)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{activity.user.fullName}</p>
                    </div>
                    <p className="text-xs whitespace-nowrap text-muted-foreground">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/90">{activity.description}</p>
                </div>
              ) : (
                <div className="px-1 py-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {formatTypeLabel(activity.type)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{activity.user.fullName}</p>
                    </div>
                    <p className="text-xs whitespace-nowrap text-muted-foreground">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{activity.description}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
