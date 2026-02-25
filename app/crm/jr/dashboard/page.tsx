
import { ActivityTimeline } from "@/components/crm/junior/activity-timeline"
import { MetricCards } from "@/components/crm/junior/metric-cards"
import { ConversionFunnelChart, FollowupDisciplineChart, LeadSourceChart, LeadTrendChart, RatesTrendChart, VisitManagementChart } from "@/components/crm/junior/performance-charts"
import { RecentLeadsTable } from "@/components/crm/junior/recent-leads-table"
import { TodaysTasks } from "@/components/crm/junior/todays-tasks"
import { VisitScheduleCard } from "@/components/crm/junior/visit-schedule"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              OMS Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Welcome back! Here is your daily overview.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Feb 25, 2026
            </span>
            <div className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
              AK
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <div className="flex flex-col gap-6">
          {/* Block 1 - Performance Metric Cards */}
          <MetricCards />

          {/* Performance Charts Section */}
          <section>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="leads">Lead Handling</TabsTrigger>
                <TabsTrigger value="followups">Follow-Ups</TabsTrigger>
                <TabsTrigger value="visits">Visits</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <LeadTrendChart />
                  <RatesTrendChart />
                  <LeadSourceChart />
                </div>
              </TabsContent>

              <TabsContent value="leads" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <LeadTrendChart />
                  <ConversionFunnelChart />
                </div>
              </TabsContent>

              <TabsContent value="followups" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FollowupDisciplineChart />
                  <RatesTrendChart />
                </div>
              </TabsContent>

              <TabsContent value="visits" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <VisitManagementChart />
                  <LeadSourceChart />
                </div>
              </TabsContent>
            </Tabs>
          </section>

          {/* Main Content: Recent Leads Table + Activity Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2/3 - Recent Leads + Tasks */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Block 2 - Recent Leads Table */}
              <RecentLeadsTable />

              {/* Block 3 & 4 - Today's Tasks + Visit Schedule */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TodaysTasks />
                <VisitScheduleCard />
              </div>
            </div>

            {/* Right 1/3 - Activity Timeline (Block 5) */}
            <div className="lg:col-span-1">
              <ActivityTimeline />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
