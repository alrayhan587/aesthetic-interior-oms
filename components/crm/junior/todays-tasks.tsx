'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Phone } from 'lucide-react'
import { fetchMeCached } from '@/lib/client-me'

type TodayFollowup = {
  id: string
  leadId: string
  followupDate: string
  status: string
  notes: string | null
  lead: {
    id: string
    name: string
    phone: string | null
  }
}

export function TodaysTasks() {
  const [tasks, setTasks] = useState<TodayFollowup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const run = async () => {
      setLoading(true)
      try {
        const meData = await fetchMeCached()
        const userId = meData?.id as string | undefined
        if (!userId) {
          throw new Error('Failed to determine current user.')
        }

        const now = new Date()
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)
        const end = new Date(now)
        end.setHours(23, 59, 59, 999)

        const params = new URLSearchParams({
          assignedToId: userId,
          status: 'PENDING',
          page: '1',
          limit: '20',
          from: start.toISOString(),
          to: end.toISOString(),
        })

        const res = await fetch(`/api/followup?${params.toString()}`)
        const data = await res.json()
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to load today followups.')
        }

        if (!active) return
        setTasks(Array.isArray(data.data) ? data.data : [])
        setError(null)
      } catch (err) {
        if (!active) return
        setTasks([])
        setError(err instanceof Error ? err.message : 'Failed to load today followups.')
      } finally {
        if (active) setLoading(false)
      }
    }

    run()
    return () => {
      active = false
    }
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base text-card-foreground">Today&apos;s Tasks</CardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">{tasks.length} followups scheduled for today</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/crm/jr/followups">View All</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">Loading today&apos;s followups...</p> : null}
        {!loading && error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!loading && !error ? (
          <div className="flex flex-col gap-3">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No followups for today.</p>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-border bg-card p-3 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/crm/jr/leads/${task.leadId}`} className="truncate text-sm font-medium text-card-foreground hover:text-primary">
                      {task.lead.name}
                    </Link>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                      Pending
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="size-3" />
                      {new Date(task.followupDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      {new Date(task.followupDate).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {task.lead.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="size-3" />
                        {task.lead.phone}
                      </span>
                    ) : null}
                  </div>
                  {task.notes ? (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{task.notes}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
