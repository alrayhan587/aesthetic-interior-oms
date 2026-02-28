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
        <h1 className="text-3xl font-bold text-white">Visit Schedule</h1>
        <p className="text-slate-400 mt-1">Weekly visit schedule and planning</p>
      </div>

      {/* Calendar Navigation */}
      <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg p-4">
        <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
          <ChevronLeft size={20} />
        </Button>
        <h2 className="text-lg font-semibold text-white">Week of Feb 26 - Mar 3, 2024</h2>
        <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
          <ChevronRight size={20} />
        </Button>
      </div>

      {/* Weekly Schedule */}
      <div className="space-y-4">
        {weekSchedule.map((daySchedule) => (
          <Card key={daySchedule.date} className="bg-slate-800 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">{daySchedule.day}</CardTitle>
                  <CardDescription>{daySchedule.date}</CardDescription>
                </div>
                <span className="text-sm bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full">
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
                      className="flex items-start gap-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors"
                    >
                      <div className="flex-shrink-0 w-16">
                        <p className="font-semibold text-white text-center">{visit.time}</p>
                        <p className="text-xs text-slate-400 text-center mt-1">{visit.duration}</p>
                      </div>
                      <div className="flex-1 border-l border-slate-600 pl-4">
                        <p className="font-medium text-white">{visit.clientName}</p>
                        <div className="flex items-center gap-2 mt-2 text-sm text-slate-300">
                          <MapPin size={16} />
                          {visit.location}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <span
                          className={`inline-block px-3 py-1 rounded text-xs font-medium ${
                            visit.status === 'confirmed'
                              ? 'bg-green-500/20 text-green-400'
                              : visit.status === 'scheduled'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}
                        >
                          {visit.status.charAt(0).toUpperCase() + visit.status.slice(1)}
                        </span>
                      </div>
                      <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white">
                        Edit
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-slate-400 py-6">No visits scheduled</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Visit Button */}
      <Button className="w-full bg-blue-600 hover:bg-blue-700 h-10">
        + Schedule New Visit
      </Button>
    </div>
  )
}
