import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Clock } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { visitSchedule } from "@/lib/dummy-data"

const visitStatusConfig: Record<
  string,
  { className: string }
> = {
  Scheduled: {
    className: "bg-primary/10 text-primary border-primary/20",
  },
  Completed: {
    className: "bg-success/10 text-success border-success/20",
  },
  Cancelled: {
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  Rescheduled: {
    className: "bg-warning/10 text-warning-foreground border-warning/20",
  },
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

export function VisitScheduleCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base text-card-foreground">Visit Schedule</CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upcoming site visits
          </p>
        </div>
        <Button variant="outline" size="sm">
          View All
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {visitSchedule.map((visit) => {
            const statusStyle = visitStatusConfig[visit.visitStatus]

            return (
              <div
                key={visit.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-secondary/50"
              >
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {getInitials(visit.leadName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-card-foreground truncate">
                      {visit.leadName}
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${statusStyle?.className || ""}`}
                    >
                      {visit.visitStatus}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" />
                      {visit.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {visit.startTime} - {visit.endTime}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {visit.scheduledDate} &middot; {visit.assignedTeamMember}
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
