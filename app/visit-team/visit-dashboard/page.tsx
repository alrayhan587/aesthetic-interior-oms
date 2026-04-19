'use client'


import { ActivityLogCard } from '@/components/visit-team/dashboard/ActivityLogCard'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { KpiMetrics } from '@/components/visit-team/dashboard/KpiMetrics'
import { TeamPerformanceCard } from '@/components/visit-team/dashboard/TeamPerformanceCard'
import { TeamWorkflowCard } from '@/components/visit-team/dashboard/TeamWorkflowCard'
import { VisitChart } from '@/components/visit-team/dashboard/VisitChart'
import { VisitScheduleCard } from '@/components/visit-team/dashboard/VisitScheduleCard'
import { generateMetrics } from '@/lib/dashboardData'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function DashboardPage() {
  const metrics = generateMetrics()

  return (
    <div className="min-h-screen bg-card">
      <CrmPageHeader
        title="Visit Team Dashboard"
        subtitle="Welcome back! Here is your daily overview."
      />

      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <div className="flex flex-col gap-6">
          <KpiMetrics metrics={metrics} />

          <section>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="workflow">Workflow</TabsTrigger>
                <TabsTrigger value="team">Team Performance</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <VisitChart />
              </TabsContent>

              <TabsContent value="workflow" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TeamWorkflowCard />
                  <TeamPerformanceCard />
                </div>
              </TabsContent>

              <TabsContent value="team" className="mt-4">
                <div className="grid grid-cols-1 gap-4">
                  <TeamPerformanceCard />
                </div>
              </TabsContent>
            </Tabs>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <VisitScheduleCard />
            </div>
            <div className="lg:col-span-1">
              <ActivityLogCard />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
