'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Clock } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const visitStatusConfig: Record<
  string,
  { className: string }
> = {
  Pending: {
    className: "bg-primary/10 text-primary border-primary/20",
  },
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
  const [visits, setVisits] = useState<
    Array<{
      id: string
      leadName: string
      location: string
      visitFee?: number | null
      projectSqft?: number | null
      projectStatus?: string | null
      scheduledAt: string
      status: string
      assignedTeamMember: string
    }>
  >([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchVisits = useCallback(async (nextOffset: number, append: boolean) => {
    if (!append) setLoading(true)
    if (append) setLoadingMore(true)
    try {
      const res = await fetch(`/api/jr/dashboard/visit-schedule?limit=20&offset=${nextOffset}`)
      const payload = await res.json()
      if (!res.ok || !payload?.success || !Array.isArray(payload.data)) {
        throw new Error(payload?.error || 'Failed to load visit schedule.')
      }

      const nextItems = payload.data as typeof visits
      setVisits((prev) => (append ? [...prev, ...nextItems] : nextItems))
      setOffset(
        typeof payload?.pagination?.nextOffset === 'number'
          ? payload.pagination.nextOffset
          : nextOffset + nextItems.length,
      )
      setHasMore(Boolean(payload?.pagination?.hasMore))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load visit schedule.')
      if (!append) setVisits([])
    } finally {
      if (!append) setLoading(false)
      if (append) setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    fetchVisits(0, false)
  }, [fetchVisits])

  const visitCards = useMemo(
    () =>
      visits.map((visit) => {
        const scheduled = new Date(visit.scheduledAt)
        const endTime = new Date(scheduled.getTime() + 60 * 60 * 1000)
        return {
          ...visit,
          scheduledDate: scheduled.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
          startTime: scheduled.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          endTime: endTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          visitStatus:
            visit.status === "SCHEDULED"
              ? "Pending"
              : visit.status.charAt(0) + visit.status.slice(1).toLowerCase(),
        }
      }),
    [visits]
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base text-card-foreground">Visit Schedule</CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upcoming site visits
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/crm/jr/visits">View All</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading visit schedule...</p>
        ) : null}
        {!loading && error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        {!loading && !error ? (
          <div className="flex flex-col gap-3">
            {visitCards.map((visit) => {
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
                    <p className="text-xs text-muted-foreground mt-1">
                      Visit Fee: Tk {visit.visitFee ?? 0}
                    </p>
                    {(visit.projectSqft || visit.projectStatus) ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        {visit.projectSqft ? `Sqft: ${visit.projectSqft}` : null}
                        {visit.projectSqft && visit.projectStatus ? ' · ' : null}
                        {visit.projectStatus
                          ? `Status: ${visit.projectStatus.replace(/_/g, " ")}`
                          : null}
                      </p>
                    ) : null}
                  </div>
                </div>
              )
            })}
            {hasMore ? (
              <div className="flex justify-center pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingMore}
                  onClick={() => fetchVisits(offset, true)}
                >
                  {loadingMore ? 'Loading...' : 'Show More'}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
