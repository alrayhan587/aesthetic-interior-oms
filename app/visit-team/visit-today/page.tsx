import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react'

const weekSchedule = [
  {
    day: 'Monday',
    date: '2024-02-26',
    visits: [
      {
        id: 1,
        time: '9:00 AM',
        clientName: 'Acme Corporation',
        location: 'Downtown Office',
        duration: '1h',
        status: 'confirmed',
      },
      {
        id: 2,
        time: '11:30 AM',
        clientName: 'Tech Innovations',
        location: 'Tech Park',
        duration: '45m',
        status: 'scheduled',
      },
      {
        id: 3,
        time: '2:00 PM',
        clientName: 'Global Solutions',
        location: 'Midtown Plaza',
        duration: '1h 30m',
        status: 'confirmed',
      },
    ],
  },
  {
    day: 'Tuesday',
    date: '2024-02-27',
    visits: [
      {
        id: 4,
        time: '10:00 AM',
        clientName: 'StartUp Hub',
        location: 'Tech District',
        duration: '1h',
        status: 'scheduled',
      },
      {
        id: 5,
        time: '3:00 PM',
        clientName: 'Enterprise Co',
        location: 'Business Park',
        duration: '45m',
        status: 'pending',
      },
    ],
  },
  {
    day: 'Wednesday',
    date: '2024-02-28',
    visits: [
      {
        id: 6,
        time: '9:30 AM',
        clientName: 'Digital Partners',
        location: 'Innovation Hub',
        duration: '1h 15m',
        status: 'confirmed',
      },
    ],
  },
]

export default function SchedulePage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Visit Schedule</h1>
        <p className="text-muted-foreground mt-1">Weekly visit schedule and planning</p>
      </div>

      {/* Calendar Navigation */}
      <div className="flex items-center justify-between bg-card border border-border rounded-lg p-4">
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <ChevronLeft size={20} />
        </Button>
        <h2 className="text-lg font-semibold text-foreground">Week of Feb 26 - Mar 3, 2024</h2>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <ChevronRight size={20} />
        </Button>
      </div>

      {/* Weekly Schedule */}
      <div className="space-y-4">
        {weekSchedule.map((daySchedule) => (
          <Card key={daySchedule.date} className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-foreground">{daySchedule.day}</CardTitle>
                  <CardDescription>{daySchedule.date}</CardDescription>
                </div>
                <span className="text-sm bg-blue-500/20 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full">
                  {daySchedule.visits.length} visits
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {daySchedule.visits.length > 0 ? (
                  daySchedule.visits.map((visit) => (
                    <div
                      key={visit.id}
                      className="flex items-start gap-4 p-4 bg-secondary/50 rounded-lg border border-border hover:border-border transition-colors"
                    >
                      <div className="flex-shrink-0 w-16">
                        <p className="font-semibold text-foreground text-center">{visit.time}</p>
                        <p className="text-xs text-muted-foreground text-center mt-1">{visit.duration}</p>
                      </div>
                      <div className="flex-1 border-l border-border pl-4">
                        <p className="font-medium text-foreground">{visit.clientName}</p>
                        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                          <MapPin size={16} />
                          {visit.location}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <span
                          className={`inline-block px-3 py-1 rounded text-xs font-medium ${
                            visit.status === 'confirmed'
                              ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                              : visit.status === 'scheduled'
                              ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                              : 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                          }`}
                        >
                          {visit.status.charAt(0).toUpperCase() + visit.status.slice(1)}
                        </span>
                      </div>
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">
                        Edit
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-6">No visits scheduled</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Visit Button */}
      <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-10">
        + Schedule New Visit
      </Button>
    </div>
  )
}
