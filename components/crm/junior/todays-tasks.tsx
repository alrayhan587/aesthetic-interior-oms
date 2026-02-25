import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Phone, Users, Mail, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import { todayFollowups } from "@/lib/dummy-data"

const typeConfig: Record<string, { icon: typeof Phone; label: string }> = {
  call: { icon: Phone, label: "Call" },
  meeting: { icon: Users, label: "Meeting" },
  email: { icon: Mail, label: "Email" },
}

const statusConfig: Record<string, { icon: typeof CheckCircle2; className: string; label: string }> = {
  done: {
    icon: CheckCircle2,
    className: "bg-success/10 text-success border-success/20",
    label: "Done",
  },
  pending: {
    icon: Clock,
    className: "bg-primary/10 text-primary border-primary/20",
    label: "Pending",
  },
  missed: {
    icon: AlertCircle,
    className: "bg-destructive/10 text-destructive border-destructive/20",
    label: "Missed",
  },
}

export function TodaysTasks() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base text-card-foreground">{"Today's Tasks"}</CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {todayFollowups.length} followups scheduled
          </p>
        </div>
        <Button variant="outline" size="sm">
          View All
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {todayFollowups.map((followup) => {
            const type = typeConfig[followup.followupType]
            const status = statusConfig[followup.status]
            const TypeIcon = type.icon
            const StatusIcon = status.icon

            return (
              <div
                key={followup.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-secondary/50"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <TypeIcon className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-card-foreground truncate">
                      {followup.leadName}
                    </p>
                    <Badge variant="outline" className={`text-[10px] ${status.className}`}>
                      <StatusIcon className="size-3 mr-0.5" />
                      {status.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {followup.note}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {type.label} &middot; {followup.assignedTo}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
