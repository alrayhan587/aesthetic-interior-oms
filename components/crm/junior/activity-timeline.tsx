import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  UserPlus,
  Phone,
  CalendarCheck,
  ArrowRight,
  StickyNote,
  CheckCircle2,
} from "lucide-react"
import { activityTimeline } from "@/lib/dummy-data"

const actionConfig: Record<
  string,
  { icon: typeof UserPlus; color: string; bg: string }
> = {
  "Lead Created": {
    icon: UserPlus,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  "Followup Completed": {
    icon: CheckCircle2,
    color: "text-success",
    bg: "bg-success/10",
  },
  "Visit Completed": {
    icon: CalendarCheck,
    color: "text-chart-2",
    bg: "bg-chart-2/10",
  },
  "Status Changed": {
    icon: ArrowRight,
    color: "text-chart-3",
    bg: "bg-chart-3/10",
  },
  "Note Added": {
    icon: StickyNote,
    color: "text-chart-4",
    bg: "bg-chart-4/10",
  },
  "Visit Scheduled": {
    icon: Phone,
    color: "text-chart-5",
    bg: "bg-chart-5/10",
  },
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffMins < 5) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays === 1) return "Yesterday"
  return `${diffDays}d ago`
}

export function ActivityTimeline() {
  const sortedTimeline = [...activityTimeline].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base text-card-foreground">Activity Timeline</CardTitle>
        <Button variant="outline" size="sm">
          View All
        </Button>
      </CardHeader>
      <CardContent>
        <div className="relative flex flex-col gap-0">
          {sortedTimeline.map((activity, index) => {
            const config = actionConfig[activity.action] || {
              icon: UserPlus,
              color: "text-muted-foreground",
              bg: "bg-muted",
            }
            const Icon = config.icon
            const isLast = index === sortedTimeline.length - 1

            return (
              <div key={activity.id} className="relative flex gap-3 pb-6 last:pb-0">
                {/* Timeline line */}
                {!isLast && (
                  <div className="absolute left-4 top-9 h-[calc(100%-12px)] w-px bg-border" />
                )}

                {/* Icon */}
                <div
                  className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${config.bg}`}
                >
                  <Icon className={`size-4 ${config.color}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-card-foreground leading-tight">
                        {activity.action}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {activity.description}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatTime(activity.createdAt)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-2">
                    <Avatar className="size-5">
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-[10px]">
                        {getInitials(activity.userName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      {activity.userName}
                    </span>
                    <span className="text-xs text-muted-foreground">{"/"}</span>
                    <span className="text-xs text-primary font-medium truncate">
                      {activity.leadName}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
