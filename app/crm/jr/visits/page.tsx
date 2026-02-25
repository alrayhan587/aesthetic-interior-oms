'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, MapPin, Clock } from 'lucide-react'

const sampleVisits = [
  { id: 1, lead: 'Acme Corp', date: '2024-02-25', time: '10:00 - 11:00', location: 'Mumbai', status: 'scheduled' },
  { id: 2, lead: 'Tech Startup', date: '2024-02-25', time: '02:00 - 03:00', location: 'Bangalore', status: 'scheduled' },
  { id: 3, lead: 'Retail Store', date: '2024-02-24', time: '03:00 - 04:00', location: 'Delhi', status: 'completed' },
  { id: 4, lead: 'Hotel Chain', date: '2024-02-26', time: '11:00 - 12:00', location: 'Goa', status: 'scheduled' },
]

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  rescheduled: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
}

export default function VisitsPage() {
  const [activeTab, setActiveTab] = useState('calendar')

  const today = new Date().toISOString().split('T')[0]
  const scheduledVisits = sampleVisits.filter((v) => v.status === 'scheduled')
  const completedVisits = sampleVisits.filter((v) => v.status === 'completed')

  const VisitCard = ({ visit }: { visit: typeof sampleVisits[0] }) => (
    <Card className="mb-3">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{visit.lead}</h3>
            <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {visit.date} - {visit.time}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {visit.location}
              </div>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[visit.status]}`}
          >
            {visit.status.charAt(0).toUpperCase() + visit.status.slice(1)}
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
          <Card>
            <CardHeader>
              <CardTitle>Calendar - Coming Soon</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center font-semibold text-muted-foreground">
                    {day}
                  </div>
                ))}
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="aspect-square p-2 border rounded-lg text-center text-sm">
                    {i + 1 <= 28 ? i + 1 : ''}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 font-semibold text-foreground">Scheduled ({scheduledVisits.length})</h3>
              {scheduledVisits.length > 0 ? (
                scheduledVisits.map((visit) => (
                  <VisitCard key={visit.id} visit={visit} />
                ))
              ) : (
                <p className="text-muted-foreground">No scheduled visits</p>
              )}
            </div>
            <div>
              <h3 className="mb-3 font-semibold text-foreground">Completed ({completedVisits.length})</h3>
              {completedVisits.length > 0 ? (
                completedVisits.map((visit) => (
                  <VisitCard key={visit.id} visit={visit} />
                ))
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
