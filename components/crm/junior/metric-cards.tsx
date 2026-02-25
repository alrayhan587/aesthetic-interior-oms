import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Users,
  CheckCircle,
  Calendar,
  TrendingUp,
  Clock,
  AlertTriangle,
  UserCheck,
  Eye,
} from "lucide-react"
import { kpiSummary } from "@/lib/dummy-data"

const topCards = [
  {
    title: "Total Leads",
    value: kpiSummary.totalLeadsAssigned.toString(),
    subtitle: `${kpiSummary.newLeadsPending} new pending`,
    icon: Users,
    trend: "+12%",
    trendUp: true,
  },
  {
    title: "Today Followups",
    value: kpiSummary.followupsDueToday.toString(),
    subtitle: `${kpiSummary.overdueFollowups} overdue`,
    icon: CheckCircle,
    trend: `${kpiSummary.followupsCompletedOnTime}% on-time`,
    trendUp: true,
  },
  {
    title: "Today Visits",
    value: kpiSummary.visitsScheduled.toString(),
    subtitle: `${kpiSummary.visitShowUpRate}% show-up rate`,
    icon: Calendar,
    trend: "+3 this week",
    trendUp: true,
  },
  {
    title: "Conversion Rate",
    value: `${kpiSummary.visitConversionRate}%`,
    subtitle: `${kpiSummary.qualifiedLeadRate}% qualified`,
    icon: TrendingUp,
    trend: "+4% vs last month",
    trendUp: true,
  },
]

const secondaryCards = [
  {
    title: "Avg First Contact",
    value: kpiSummary.firstContactTimeAvg,
    icon: Clock,
  },
  {
    title: "Contact Rate",
    value: `${kpiSummary.contactRate}%`,
    icon: UserCheck,
  },
  {
    title: "Overdue Followups",
    value: kpiSummary.overdueFollowups.toString(),
    icon: AlertTriangle,
  },
  {
    title: "Rejection Rate",
    value: `${kpiSummary.rejectionRate}%`,
    icon: Eye,
  },
]

export function MetricCards() {
  return (
    <div className="flex flex-col gap-4">
      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {topCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="size-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight text-card-foreground">
                  {card.value}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs font-medium text-success">
                    {card.trend}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {card.subtitle}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Secondary KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {secondaryCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="py-3">
              <CardContent className="flex items-center gap-3 px-4 py-0">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary">
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{card.title}</p>
                  <p className="text-lg font-semibold text-card-foreground">{card.value}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
