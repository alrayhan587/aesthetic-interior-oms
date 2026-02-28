import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MapPin, Clock, Calendar, CheckCircle2, Clock3, AlertCircle } from 'lucide-react'

const visitHistory = [
  {
    id: 1,
    clientName: 'Acme Corporation',
    location: 'Downtown Office',
    scheduledDate: '2024-02-26',
    scheduledTime: '10:00 AM',
    completedAt: '10:35 AM',
    duration: '35 min',
    notes: 'Met with John Smith. Discussed Q2 strategy.',
    status: 'completed',
  },
  {
    id: 2,
    clientName: 'Tech Innovations Inc',
    location: 'Tech Park, Building A',
    scheduledDate: '2024-02-25',
    scheduledTime: '2:30 PM',
    completedAt: '3:15 PM',
    duration: '45 min',
    notes: 'Product demo completed. Client interested in premium plan.',
    status: 'completed',
  },
  {
    id: 3,
    clientName: 'Global Solutions Ltd',
    location: 'Midtown Plaza',
    scheduledDate: '2024-02-24',
    scheduledTime: '4:00 PM',
    completedAt: null,
    duration: null,
    notes: null,
    status: 'missed',
  },
]

const upcomingVisits = [
  {
    id: 4,
    clientName: 'StartUp Hub',
    location: 'Tech District',
    scheduledDate: '2024-02-26',
    scheduledTime: '2:00 PM',
    days: 'today',
    status: 'scheduled',
  },
  {
    id: 5,
    clientName: 'Digital Partners',
    location: 'Innovation Hub',
    scheduledDate: '2024-02-27',
    scheduledTime: '9:30 AM',
    days: 'tomorrow',
    status: 'scheduled',
  },
  {
    id: 6,
    clientName: 'Enterprise Co',
    location: 'Business Park',
    scheduledDate: '2024-02-28',
    scheduledTime: '10:00 AM',
    days: '2 days',
    status: 'pending',
  },
]

export default function MyVisitsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">My Visits</h1>
        <p className="text-slate-400 mt-1">Track your visit history and upcoming appointments</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="bg-slate-800 border-slate-700">
          <TabsTrigger value="upcoming" className="data-[state=active]:bg-blue-600">
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="completed" className="data-[state=active]:bg-blue-600">
            Completed
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-blue-600">
            History
          </TabsTrigger>
        </TabsList>

        {/* Upcoming Tab */}
        <TabsContent value="upcoming" className="space-y-4">
          {upcomingVisits.map((visit) => (
            <Card key={visit.id} className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-white text-lg">{visit.clientName}</p>
                    <div className="flex gap-4 mt-3 text-sm text-slate-300">
                      <span className="flex items-center gap-2">
                        <MapPin size={16} />
                        {visit.location}
                      </span>
                      <span className="flex items-center gap-2">
                        <Clock size={16} />
                        {visit.scheduledTime}
                      </span>
                      <span className="flex items-center gap-2">
                        <Calendar size={16} />
                        {visit.days}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="inline-block px-3 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
                      Scheduled
                    </span>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="default" className="bg-blue-600 hover:bg-blue-700">
                        Check-in
                      </Button>
                      <Button size="sm" variant="outline" className="border-slate-600">
                        Reschedule
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Completed Tab */}
        <TabsContent value="completed" className="space-y-4">
          {visitHistory
            .filter((v) => v.status === 'completed')
            .map((visit) => (
              <Card key={visit.id} className="bg-slate-800 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={20} className="text-green-500" />
                        <p className="font-semibold text-white text-lg">{visit.clientName}</p>
                      </div>
                      <div className="flex gap-4 mt-3 text-sm text-slate-300 ml-7">
                        <span className="flex items-center gap-1">
                          <MapPin size={14} />
                          {visit.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock3 size={14} />
                          {visit.duration}
                        </span>
                      </div>
                      {visit.notes && (
                        <p className="text-sm text-slate-300 mt-3 ml-7 italic">"{visit.notes}"</p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      <span className="inline-block px-3 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400">
                        Completed
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          {visitHistory.map((visit) => (
            <Card key={visit.id} className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {visit.status === 'completed' ? (
                        <CheckCircle2 size={20} className="text-green-500" />
                      ) : (
                        <AlertCircle size={20} className="text-red-500" />
                      )}
                      <p className="font-semibold text-white text-lg">{visit.clientName}</p>
                    </div>
                    <div className="flex gap-4 mt-3 text-sm text-slate-300 ml-7">
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {visit.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {visit.scheduledDate}
                      </span>
                      {visit.completedAt && (
                        <span className="flex items-center gap-1">
                          <Clock3 size={14} />
                          Completed: {visit.completedAt}
                        </span>
                      )}
                    </div>
                    {visit.notes && (
                      <p className="text-sm text-slate-300 mt-3 ml-7 italic">"{visit.notes}"</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <span
                      className={`inline-block px-3 py-1 rounded text-xs font-medium ${
                        visit.status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {visit.status.charAt(0).toUpperCase() + visit.status.slice(1)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
