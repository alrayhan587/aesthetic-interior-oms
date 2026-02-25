"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
} from "recharts"
import {
  monthlyLeadData,
  followupDisciplineData,
  visitManagementData,
  leadSourceData,
  ratesTrendData,
  conversionFunnelData,
} from "@/lib/dummy-data"

// ---- Chart Configs ----

const leadTrendConfig: ChartConfig = {
  totalLeads: { label: "Total Leads", color: "var(--color-chart-1)" },
  contacted: { label: "Contacted", color: "var(--color-chart-2)" },
  pending: { label: "Pending", color: "var(--color-chart-3)" },
}

const followupConfig: ChartConfig = {
  onTime: { label: "On Time", color: "var(--color-chart-2)" },
  overdue: { label: "Overdue", color: "var(--color-chart-3)" },
  missed: { label: "Missed", color: "var(--color-destructive)" },
}

const visitConfig: ChartConfig = {
  completed: { label: "Completed", color: "var(--color-chart-2)" },
  scheduled: { label: "Scheduled", color: "var(--color-chart-1)" },
  cancelled: { label: "Cancelled", color: "var(--color-destructive)" },
  rescheduled: { label: "Rescheduled", color: "var(--color-chart-3)" },
}

const sourceConfig: ChartConfig = {
  Facebook: { label: "Facebook", color: "var(--color-chart-1)" },
  Referral: { label: "Referral", color: "var(--color-chart-2)" },
  Website: { label: "Website", color: "var(--color-chart-3)" },
  Instagram: { label: "Instagram", color: "var(--color-chart-4)" },
  Manual: { label: "Manual", color: "var(--color-chart-5)" },
}

const ratesConfig: ChartConfig = {
  contactRate: { label: "Contact Rate %", color: "var(--color-chart-1)" },
  visitConversion: { label: "Visit Conversion %", color: "var(--color-chart-2)" },
  qualifiedRate: { label: "Qualified Rate %", color: "var(--color-chart-3)" },
}

const funnelConfig: ChartConfig = {
  value: { label: "Leads", color: "var(--color-chart-1)" },
}

// ---- Components ----

export function LeadTrendChart() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-card-foreground">Lead Handling Trend</CardTitle>
        <p className="text-xs text-muted-foreground">Monthly lead assignment & contact rate</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={leadTrendConfig} className="h-[260px] w-full">
          <AreaChart data={monthlyLeadData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="month" className="text-xs" tickLine={false} axisLine={false} />
            <YAxis className="text-xs" tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="totalLeads"
              stroke="var(--color-chart-1)"
              fill="var(--color-chart-1)"
              fillOpacity={0.1}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="contacted"
              stroke="var(--color-chart-2)"
              fill="var(--color-chart-2)"
              fillOpacity={0.08}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function FollowupDisciplineChart() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-card-foreground">Follow-Up Discipline</CardTitle>
        <p className="text-xs text-muted-foreground">Weekly on-time vs overdue followups</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={followupConfig} className="h-[260px] w-full">
          <BarChart data={followupDisciplineData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="week" className="text-xs" tickLine={false} axisLine={false} />
            <YAxis className="text-xs" tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="onTime" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="overdue" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="missed" fill="var(--color-destructive)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function VisitManagementChart() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-card-foreground">Visit Management</CardTitle>
        <p className="text-xs text-muted-foreground">Monthly visit scheduling & completion</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={visitConfig} className="h-[260px] w-full">
          <BarChart data={visitManagementData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="month" className="text-xs" tickLine={false} axisLine={false} />
            <YAxis className="text-xs" tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="completed" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} stackId="stack" />
            <Bar dataKey="cancelled" fill="var(--color-destructive)" radius={[0, 0, 0, 0]} stackId="stack" />
            <Bar dataKey="rescheduled" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} stackId="stack" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function LeadSourceChart() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-card-foreground">Lead Sources</CardTitle>
        <p className="text-xs text-muted-foreground">Distribution by acquisition channel</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={sourceConfig} className="mx-auto h-[260px] w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="source" />} />
            <Pie
              data={leadSourceData}
              dataKey="count"
              nameKey="source"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              strokeWidth={2}
              stroke="var(--color-card)"
            >
              {leadSourceData.map((entry) => (
                <Cell key={entry.source} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          {leadSourceData.map((item) => (
            <div key={item.source} className="flex items-center gap-1.5">
              <div
                className="size-2.5 rounded-full"
                style={{ backgroundColor: item.fill }}
              />
              <span className="text-xs text-muted-foreground">
                {item.source} ({item.count})
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function RatesTrendChart() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-card-foreground">Performance Rates</CardTitle>
        <p className="text-xs text-muted-foreground">Contact, conversion & qualification trends</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={ratesConfig} className="h-[260px] w-full">
          <LineChart data={ratesTrendData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="month" className="text-xs" tickLine={false} axisLine={false} />
            <YAxis className="text-xs" tickLine={false} axisLine={false} domain={[0, 100]} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="contactRate"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-chart-1)" }}
            />
            <Line
              type="monotone"
              dataKey="visitConversion"
              stroke="var(--color-chart-2)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-chart-2)" }}
            />
            <Line
              type="monotone"
              dataKey="qualifiedRate"
              stroke="var(--color-chart-3)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-chart-3)" }}
            />
          </LineChart>
        </ChartContainer>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-full bg-chart-1" />
            <span className="text-xs text-muted-foreground">Contact Rate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-full bg-chart-2" />
            <span className="text-xs text-muted-foreground">Visit Conversion</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-full bg-chart-3" />
            <span className="text-xs text-muted-foreground">Qualified Rate</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ConversionFunnelChart() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-card-foreground">Conversion Funnel</CardTitle>
        <p className="text-xs text-muted-foreground">Lead progression through stages</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={funnelConfig} className="h-[260px] w-full">
          <BarChart
            data={conversionFunnelData}
            layout="vertical"
            margin={{ top: 8, right: 8, bottom: 0, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/50" />
            <XAxis type="number" className="text-xs" tickLine={false} axisLine={false} />
            <YAxis
              dataKey="stage"
              type="category"
              className="text-xs"
              tickLine={false}
              axisLine={false}
              width={100}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {conversionFunnelData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={`var(--color-chart-${(index % 5) + 1})`}
                  opacity={1 - index * 0.12}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
