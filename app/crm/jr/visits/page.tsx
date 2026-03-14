'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, MapPin, Clock, ChevronLeft, ChevronRight, Phone, Mail, User } from 'lucide-react'

// Dummy leads data
const dummyLeads = [
  {
    id: 'lead-001',
    name: 'Moinul Islam',
    phone: '+8801234567890',
    email: 'moinul@example.com',
    location: 'Dhaka',
    status: 'NEW',
    budget: 500000,
    source: 'Website',
    remarks: 'Interested in interior design',
  },
  {
    id: 'lead-002',
    name: 'Acme Corp',
    phone: '+8801111111111',
    email: 'contact@acmecorp.com',
    location: 'Mumbai',
    status: 'QUALIFIED',
    budget: 2000000,
    source: 'Referral',
    remarks: 'Large commercial project',
  },
  {
    id: 'lead-003',
    name: 'Tech Startup Inc',
    phone: '+8801222222222',
    email: 'sales@techstartup.com',
    location: 'Bangalore',
    status: 'NEGOTIATION',
    budget: 1500000,
    source: 'Online',
    remarks: 'Office renovation needed',
  },
  {
    id: 'lead-004',
    name: 'Retail Store Co',
    phone: '+8801333333333',
    email: 'retail@company.com',
    location: 'Delhi',
    status: 'QUALIFIED',
    budget: 750000,
    source: 'Website',
    remarks: 'Retail space design',
  },
  {
    id: 'lead-005',
    name: 'Hotel Chain Ltd',
    phone: '+8801444444444',
    email: 'operations@hotelchain.com',
    location: 'Goa',
    status: 'PROSPECT',
    budget: 3000000,
    source: 'Partner',
    remarks: 'Hotel renovation project',
  },
]

// Dummy visits data
const dummyVisits = [
  {
    id: 'visit-001',
    leadId: 'lead-001',
    scheduledAt: '2026-03-20T10:00:00.000Z',
    location: '123 Main Street, Dhaka',
    status: 'SCHEDULED',
    notes: 'Bring the latest floor plan',
    assignedToName: 'Sarah Smith',
  },
  {
    id: 'visit-002',
    leadId: 'lead-001',
    scheduledAt: '2026-03-25T14:00:00.000Z',
    location: '123 Main Street, Dhaka',
    status: 'SCHEDULED',
    notes: 'Follow-up discussion on design',
    assignedToName: 'Sarah Smith',
  },
  {
    id: 'visit-003',
    leadId: 'lead-002',
    scheduledAt: '2026-03-18T09:00:00.000Z',
    location: 'Acme Corp Office, Mumbai',
    status: 'COMPLETED',
    notes: 'Discussed project scope',
    assignedToName: 'John Doe',
  },
  {
    id: 'visit-004',
    leadId: 'lead-002',
    scheduledAt: '2026-03-30T11:00:00.000Z',
    location: 'Acme Corp Office, Mumbai',
    status: 'SCHEDULED',
    notes: 'Present final proposal',
    assignedToName: 'John Doe',
  },
  {
    id: 'visit-005',
    leadId: 'lead-003',
    scheduledAt: '2026-03-22T15:30:00.000Z',
    location: 'Tech Startup HQ, Bangalore',
    status: 'SCHEDULED',
    notes: 'Site inspection',
    assignedToName: 'Emma Watson',
  },
  {
    id: 'visit-006',
    leadId: 'lead-004',
    scheduledAt: '2026-03-17T13:00:00.000Z',
    location: 'Retail Store, Delhi',
    status: 'COMPLETED',
    notes: 'Retail space assessment',
    assignedToName: 'Michael Brown',
  },
  {
    id: 'visit-007',
    leadId: 'lead-005',
    scheduledAt: '2026-04-05T10:30:00.000Z',
    location: 'Hotel Chain Resort, Goa',
    status: 'SCHEDULED',
    notes: 'Renovation planning meeting',
    assignedToName: 'Lisa Anderson',
  },
]



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

const leadStatusColors: Record<string, string> = {
  NEW: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  PROSPECT: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  QUALIFIED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  NEGOTIATION: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  CONVERTED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
}

export default function VisitsPage() {
  const [activeTab, setActiveTab] = useState('calendar')
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2)) // March 2026
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Create lead lookup map for quick access
  const leadMap = useMemo(() => {
    const map: Record<string, typeof dummyLeads[0]> = {}
    dummyLeads.forEach((lead) => {
      map[lead.id] = lead
    })
    return map
  }, [])

  // Enrich visits with lead data
  const visitsWithLeads = useMemo(() => {
    return dummyVisits.map((visit) => ({
      ...visit,
      lead: leadMap[visit.leadId],
    }))
  }, [leadMap])

  const scheduledVisits = visitsWithLeads.filter((v) => v.status === 'SCHEDULED')
  const completedVisits = visitsWithLeads.filter((v) => v.status === 'COMPLETED')

  // Group visits by date (YYYY-MM-DD from ISO string)
  const visitsByDate = useMemo(() => {
    const grouped: Record<string, typeof visitsWithLeads> = {}
    visitsWithLeads.forEach((visit) => {
      const dateStr = visit.scheduledAt.split('T')[0]
      if (!grouped[dateStr]) grouped[dateStr] = []
      grouped[dateStr].push(visit)
    })
    return grouped
  }, [visitsWithLeads])

  // Get calendar days for current month
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDayOfMonth(currentDate)
  const calendarDays = Array.from({ length: firstDay }).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  )

  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const getDateString = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    return date.toISOString().split('T')[0]
  }

  const getVisitsForDay = (day: number) => {
    const dateStr = getDateString(day)
    return visitsByDate[dateStr] || []
  }

  const VisitCard = ({ visit }: { visit: typeof visitsWithLeads[0] }) => (
    <Card className="mb-3 overflow-hidden">
      <CardContent className="pt-6">
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
              {visit.notes && <p className="text-xs text-muted-foreground italic mt-2">{visit.notes}</p>}
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Visits</h1>
          <p className="mt-1 text-muted-foreground">Schedule and manage site visits</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Schedule Visit
        </Button>
      </div>

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
                    {calendarDays.map((day, idx) => {
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
                  {selectedDate && visitsByDate[selectedDate] ? (
                    <div className="space-y-3">
                      {visitsByDate[selectedDate].map((visit) => (
                        <div
                          key={visit.id}
                          className="p-3 border rounded-lg space-y-2 bg-muted/50"
                        >
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
                      ))}
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
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 font-semibold text-foreground">Scheduled ({scheduledVisits.length})</h3>
              {scheduledVisits.length > 0 ? (
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
              {completedVisits.length > 0 ? (
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
