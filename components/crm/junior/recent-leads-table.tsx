"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Phone, Eye, CalendarPlus } from "lucide-react"
import { recentLeads, type LeadStatus } from "@/lib/dummy-data"

const statusConfig: Record<
  LeadStatus,
  { label: string; className: string }
> = {
  NEW: {
    label: "New",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  CONTACTED: {
    label: "Contacted",
    className: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  },
  FOLLOWUP: {
    label: "Follow Up",
    className: "bg-warning/10 text-warning-foreground border-warning/20",
  },
  VISIT_SCHEDULED: {
    label: "Visit Set",
    className: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  CONVERTED: {
    label: "Converted",
    className: "bg-success/10 text-success border-success/20",
  },
}

const sourceColors: Record<string, string> = {
  facebook: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  referral: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  website: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  instagram: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  manual: "bg-muted text-muted-foreground border-border",
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHrs < 1) return "Just now"
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays === 1) return "Yesterday"
  return `${diffDays}d ago`
}

export function RecentLeadsTable() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base text-card-foreground">Recent Leads</CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Latest leads assigned to your team
          </p>
        </div>
        <Button variant="outline" size="sm">
          View All
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Client</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentLeads.map((lead) => {
              const status = statusConfig[lead.status]
              return (
                <TableRow key={lead.id}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getInitials(lead.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-card-foreground">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">{lead.phone}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.location}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-card-foreground">{lead.projectType}</p>
                      <p className="text-xs text-muted-foreground">
                        {lead.projectSize}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={sourceColors[lead.source] || ""}
                    >
                      {lead.source}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={status.className}>
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDate(lead.createdAt)}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" aria-label="View lead details">
                        <Eye className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" aria-label="Call lead">
                        <Phone className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" aria-label="Schedule visit">
                        <CalendarPlus className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
