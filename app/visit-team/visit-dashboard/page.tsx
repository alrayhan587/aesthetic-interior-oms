import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, MapPin, Clock, Users } from 'lucide-react'

const stats = [
  {
    label: 'Today\'s Visits',
    value: '3',
    icon: Calendar,
    color: 'bg-blue-500/10 text-blue-600',
  },
  {
    label: 'Scheduled This Week',
    value: '12',
    icon: Clock,
    color: 'bg-green-500/10 text-green-600',
  },
  {
    label: 'Completed',
    value: '28',
    icon: Users,
    color: 'bg-purple-500/10 text-purple-600',
  },
  {
    label: 'Pending',
    value: '5',
    icon: MapPin,
    color: 'bg-orange-500/10 text-orange-600',
  },
]

const upcomingVisits = [
  {
    id: 1,
    clientName: 'Acme Corporation',
    location: 'Downtown Office',
    time: '10:00 AM',
    date: 'Today',
    status: 'scheduled',
  },
  {
    id: 2,
    clientName: 'Tech Innovations Inc',
    location: 'Tech Park, Building A',
    time: '2:30 PM',
    date: 'Today',
    status: 'scheduled',
  },
  {
    id: 3,
    clientName: 'Global Solutions Ltd',
    location: 'Midtown Plaza',
    time: '4:00 PM',
    date: 'Today',
    status: 'confirmed',
  },
  {
    id: 4,
    clientName: 'StartUp Hub',
    location: 'Tech District',
    time: '10:00 AM',
    date: 'Tomorrow',
    status: 'scheduled',
  },
]

export default function VisitDashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Visit Dashboard</h1>
        <p className="text-slate-400 mt-1">Manage your scheduled visits and track your visit history</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">{stat.label}</p>
                    <p className="text-2xl font-bold text-white mt-2">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.color}`}>
                    <Icon size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Upcoming Visits */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Upcoming Visits</CardTitle>
          <CardDescription>Your next scheduled visits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {upcomingVisits.map((visit) => (
              <div
                key={visit.id}
                className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium text-white">{visit.clientName}</p>
                  <div className="flex gap-4 mt-2 text-sm text-slate-300">
                    <span className="flex items-center gap-1">
                      <MapPin size={16} />
                      {visit.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={16} />
                      {visit.time}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">{visit.date}</p>
                  <span
                    className={`inline-block mt-2 px-3 py-1 rounded text-xs font-medium ${
                      visit.status === 'confirmed'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}
                  >
                    {visit.status.charAt(0).toUpperCase() + visit.status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Button className="bg-blue-600 hover:bg-blue-700">Schedule New Visit</Button>
        <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
          View Calendar
        </Button>
      </div>
    </div>
  )
}
