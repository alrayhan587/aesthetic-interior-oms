'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, MapPin, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { fetchMeCached } from '@/lib/client-me'

type VisitRecord = {
  id: string
  leadId: string
  scheduledAt: string
  location: string
  projectSqft: number | null
  projectStatus: string | null
  status: string
  notes: string | null
  lead: {
    id: string
    name: string
    phone: string
    location: string | null
  }
  assignedTo: {
    id: string
    fullName: string
    email: string
    phone: string
  } | null
  createdBy: {
    id: string
    fullName: string
  } | null
}

type ApiResponse = {
  success: boolean
  data?: VisitRecord[]
  error?: string
}

type VisitsCacheEntry = {
  savedAt: number
  data: VisitRecord[]
}

const VISITS_CACHE_TTL_MS = 60_000
let visitsCache: VisitsCacheEntry | null = null
let visitsRequestPromise: Promise<VisitRecord[]> | null = null

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  SCHEDULED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  rescheduled: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  RESCHEDULED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
}

type VisitsPageProps = {
  forceAssignedOnly?: boolean
}

export function VisitsPageView({ forceAssignedOnly = false }: VisitsPageProps) {
  const [activeTab, setActiveTab] = useState('calendar')
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2)) // March 2026
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [visits, setVisits] = useState<VisitRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const formatLocalDateKey = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  useEffect(() => {
    setSelectedDate(formatLocalDateKey(new Date()))
  }, [])

  useEffect(() => {
    const loadVisits = async () => {
      try {
        const cached = visitsCache
        const cacheIsFresh =
          cached && Date.now() - cached.savedAt < VISITS_CACHE_TTL_MS
        if (cacheIsFresh) {
          setVisits(cached.data)
          setError(null)
          return
        }

        if (!visitsRequestPromise) {
          visitsRequestPromise = (async () => {
            const response = await fetch('/api/visit-schedule')
            const payload = (await response.json()) as ApiResponse
            if (!response.ok || !payload.success) {
              const message =
                payload?.error
                  ? String(payload.error)
                  : `Failed to load visits (status ${response.status})`
              throw new Error(message)
            }
            return payload.data ?? []
          })()
            .finally(() => {
              visitsRequestPromise = null
            })
        }

        const nextVisits = await visitsRequestPromise
        visitsCache = { data: nextVisits, savedAt: Date.now() }
        setVisits(nextVisits)
        setError(null)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load visits'
        console.error('Error loading visits:', error)
        setError(message)
        setVisits([])
      } finally {
        setLoading(false)
      }
    }

    loadVisits()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    fetchMeCached()
      .then((data) => {
        if (data?.id) {
          setCurrentUserId(String(data.id))
        }
      })
      .catch((error) => {
        console.error('Error loading current user:', error)
      })
  }, [])

  const normalizedSearch = searchTerm.trim().toLowerCase()
  const numericSearch = searchTerm.replace(/\D/g, '')

  const filteredVisits = useMemo(() => {
    if (!normalizedSearch && !numericSearch) return visits

    return visits.filter((visit) => {
      const leadName = visit.lead?.name?.toLowerCase() ?? ''
      const leadPhone = visit.lead?.phone?.replace(/\D/g, '') ?? ''
      const nameMatch = normalizedSearch ? leadName.includes(normalizedSearch) : false
      const phoneMatch = numericSearch ? leadPhone.includes(numericSearch) : false
      return nameMatch || phoneMatch
    })
  }, [visits, normalizedSearch, numericSearch])

  const scheduledVisits = useMemo(
    () => filteredVisits.filter((v) => v.status === 'SCHEDULED'),
    [filteredVisits]
  )
  const completedVisits = useMemo(
    () => filteredVisits.filter((v) => v.status === 'COMPLETED'),
    [filteredVisits]
  )

  // Group visits by date (YYYY-MM-DD from ISO string)
  const visitsByDate = useMemo(() => {
    const grouped: Record<string, VisitRecord[]> = {}
    visits.forEach((visit) => {
      const scheduledDate = new Date(visit.scheduledAt)
      const dateStr = Number.isNaN(scheduledDate.getTime())
        ? visit.scheduledAt.split('T')[0]
        : formatLocalDateKey(scheduledDate)
      if (!grouped[dateStr]) grouped[dateStr] = []
      grouped[dateStr].push(visit)
    })
    return grouped
  }, [visits])

  // Get calendar days for current month
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDayOfMonth(currentDate)
  const calendarDays: Array<number | null> = [
    ...Array.from({ length: firstDay }, () => null as null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const getDateString = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    return formatLocalDateKey(date)
  }

  const getVisitsForDay = (day: number) => {
    const dateStr = getDateString(day)
    return visitsByDate[dateStr] || []
  }

  const canViewVisit = (visit: VisitRecord) => {
    if (forceAssignedOnly) return true
    const creatorId = visit.createdBy?.id
    if (!currentUserId || !creatorId) return true
    return creatorId === currentUserId
  }

  const VisitCard = ({ visit }: { visit: VisitRecord }) => {
    const isVisible = canViewVisit(visit)
    const leadHref = forceAssignedOnly
      ? `/visit-team/leads/${visit.lead.id}`
      : `/crm/jr/leads/${visit.lead.id}`

    return (
      <Card className="mb-3 overflow-hidden relative">
        {!isVisible ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-xs font-semibold text-muted-foreground bg-background/70">
            Restricted to assigned CRM
          </div>
        ) : null}
        <CardContent className={`pt-6 ${!isVisible ? 'blur-xs pointer-events-none select-none' : ''}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold text-foreground">{visit.lead?.name || 'Unknown'}</h3>
                <p className="text-xs text-muted-foreground">{visit.lead?.location || 'N/A'}</p>
              </div>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span>
                    {new Date(visit.scheduledAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    at{' '}
                    {new Date(visit.scheduledAt).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{visit.location}</span>
                </div>
                {visit.projectSqft ? (
                  <p className="text-xs text-muted-foreground">Sqft: {visit.projectSqft}</p>
                ) : null}
                {visit.projectStatus ? (
                  <p className="text-xs text-muted-foreground">
                    Project Status: {visit.projectStatus.replace(/_/g, ' ')}
                  </p>
                ) : null}
                {visit.notes && <p className="text-xs text-muted-foreground italic mt-2">{visit.notes}</p>}
                <div className="pt-1">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={leadHref}>Open Lead Details</Link>
                  </Button>
                </div>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusColors[visit.status]}`}
            >
              {visit.status}
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="Visits"
        subtitle="Schedule and manage site visits"
      />
      <main className="mx-auto max-w-[1440px] px-6 py-6 space-y-6">
        <div className="flex items-center justify-end">
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Schedule Visit
        </Button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading visits...</p> : null}
      {!loading && error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Calendar */}
            <div className="col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>{monthYear}</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrevMonth}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleNextMonth}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="text-center font-semibold text-muted-foreground text-sm py-2">
                        {day}
                      </div>
                    ))}
                    {loading
                      ? Array.from({ length: 35 }).map((_, idx) => (
                          <div key={idx} className="aspect-square rounded-lg border bg-muted/60 animate-pulse" />
                        ))
                      : calendarDays.map((day, idx) => {
                          const visitsForDay = day ? getVisitsForDay(day) : []
                          const dateStr = day ? getDateString(day) : null
                          const isSelected = selectedDate === dateStr

                          return (
                            <div
                              key={idx}
                              onClick={() => day && setSelectedDate(dateStr)}
                              className={`aspect-square p-2 border rounded-lg text-center cursor-pointer transition-colors ${
                                !day
                                  ? 'bg-muted'
                                  : isSelected
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : visitsForDay.length > 0
                                      ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-400'
                                      : 'hover:border-gray-400'
                              }`}
                            >
                              {day && (
                                <div className="flex flex-col items-center justify-center h-full">
                                  <span className="font-semibold text-sm">{day}</span>
                                  {visitsForDay.length > 0 && (
                                    <span className="inline-flex items-center justify-center w-5 h-5 mt-1 text-xs font-bold text-white bg-blue-500 rounded-full">
                                      {visitsForDay.length}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Selected Day Details */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {selectedDate
                      ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Select a Day'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, idx) => (
                        <div key={idx} className="rounded-lg border p-3 space-y-2 animate-pulse">
                          <div className="h-4 w-36 rounded bg-muted" />
                          <div className="h-3 w-24 rounded bg-muted" />
                          <div className="h-3 w-full rounded bg-muted" />
                        </div>
                      ))}
                    </div>
                  ) : selectedDate && visitsByDate[selectedDate] ? (
                    <div className="space-y-3">
                      {visitsByDate[selectedDate].map((visit) => {
                        const isVisible = canViewVisit(visit)
                        return (
                          <div
                            key={visit.id}
                            className="p-3 border rounded-lg space-y-2 bg-muted/50 relative overflow-hidden"
                          >
                            {!isVisible ? (
                              <div className="absolute inset-0 z-10 flex items-center justify-center text-[10px] font-semibold text-muted-foreground bg-background/70">
                                Restricted to assigned CRM
                              </div>
                            ) : null}
                            <div className={!isVisible ? 'blur-xs pointer-events-none select-none' : ''}>
                              <div>
                                <h4 className="font-semibold text-sm">{visit.lead?.name || 'Unknown'}</h4>
                                <p className="text-xs text-muted-foreground">{visit.lead?.location}</p>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {new Date(visit.scheduledAt).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                <span className="line-clamp-2">{visit.location}</span>
                              </div>
                              <span
                                className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                  statusColors[visit.status]
                                }`}
                              >
                                {visit.status}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {selectedDate ? 'No visits scheduled' : 'Click on a day to see visits'}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by lead name or phone"
                className="max-w-sm"
              />
              {searchTerm ? (
                <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')}>
                  Clear
                </Button>
              ) : null}
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="mb-3 font-semibold text-foreground">Scheduled ({scheduledVisits.length})</h3>
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <Card key={idx} className="border-border animate-pulse">
                        <CardContent className="h-44" />
                      </Card>
                    ))}
                  </div>
                ) : scheduledVisits.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {scheduledVisits.map((visit) => (
                      <VisitCard key={visit.id} visit={visit} />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No scheduled visits</p>
                )}
              </div>
              <div>
                <h3 className="mb-3 font-semibold text-foreground">Completed ({completedVisits.length})</h3>
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <Card key={idx} className="border-border animate-pulse">
                        <CardContent className="h-44" />
                      </Card>
                    ))}
                  </div>
                ) : completedVisits.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {completedVisits.map((visit) => (
                      <VisitCard key={visit.id} visit={visit} />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No completed visits</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      </main>
    </div>
  )
}

export default function VisitsPage() {
  return <VisitsPageView />
}
