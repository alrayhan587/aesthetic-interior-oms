'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, CheckCircle, Clock, AlertCircle } from 'lucide-react'

const sampleFollowups = [
  { id: 1, lead: 'Acme Corp', type: 'call', date: '2024-02-25', status: 'pending', note: 'Follow up on proposal' },
  { id: 2, lead: 'Tech Startup', type: 'meeting', date: '2024-02-25', status: 'pending', note: 'Site visit discussion' },
  { id: 3, lead: 'Retail Store', type: 'call', date: '2024-02-24', status: 'done', note: 'Discussed requirements' },
  { id: 4, lead: 'Hospital Group', type: 'meeting', date: '2024-02-23', status: 'missed', note: 'Missed meeting' },
  { id: 5, lead: 'Hotel Chain', type: 'call', date: '2024-02-26', status: 'pending', note: 'Initial consultation' },
]

export default function FollowupsPage() {
  const [activeTab, setActiveTab] = useState('today')

  const today = new Date().toISOString().split('T')[0]

  const todayFollowups = sampleFollowups.filter((f) => f.date === today && f.status === 'pending')
  const upcomingFollowups = sampleFollowups.filter((f) => f.date > today && f.status === 'pending')
  const overdueFollowups = sampleFollowups.filter((f) => f.date < today && f.status === 'pending')
  const completedFollowups = sampleFollowups.filter((f) => f.status === 'done')

  const FollowupCard = ({ followup }: { followup: typeof sampleFollowups[0] }) => (
    <Card className="mb-3">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{followup.lead}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{followup.note}</p>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="rounded bg-blue-100 px-2 py-1 capitalize text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                {followup.type}
              </span>
              <span>{followup.date}</span>
            </div>
          </div>
          <Button size="sm" variant="outline">
            {followup.status === 'done' ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : followup.status === 'missed' ? (
              <AlertCircle className="w-4 h-4 text-red-600" />
            ) : (
              <Clock className="w-4 h-4 text-yellow-600" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Followups</h1>
          <p className="mt-1 text-muted-foreground">Track all your followup tasks</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Followup
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="today">Today ({todayFollowups.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({upcomingFollowups.length})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({overdueFollowups.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedFollowups.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-6">
          {todayFollowups.length > 0 ? (
            todayFollowups.map((followup) => (
              <FollowupCard key={followup.id} followup={followup} />
            ))
          ) : (
            <Card>
              <CardContent className="pt-12 text-center">
                <p className="text-muted-foreground">No followups for today</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-6">
          {upcomingFollowups.length > 0 ? (
            upcomingFollowups.map((followup) => (
              <FollowupCard key={followup.id} followup={followup} />
            ))
          ) : (
            <Card>
              <CardContent className="pt-12 text-center">
                <p className="text-muted-foreground">No upcoming followups</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="overdue" className="mt-6">
          {overdueFollowups.length > 0 ? (
            overdueFollowups.map((followup) => (
              <FollowupCard key={followup.id} followup={followup} />
            ))
          ) : (
            <Card>
              <CardContent className="pt-12 text-center">
                <p className="text-muted-foreground">No overdue followups</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {completedFollowups.length > 0 ? (
            completedFollowups.map((followup) => (
              <FollowupCard key={followup.id} followup={followup} />
            ))
          ) : (
            <Card>
              <CardContent className="pt-12 text-center">
                <p className="text-muted-foreground">No completed followups</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
