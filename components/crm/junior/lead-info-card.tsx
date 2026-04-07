'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Phone, Mail, MapPin, DollarSign, FileText, Clock } from 'lucide-react'

type LeadDetails = {
  id: string
  name: string
  phone: string | null
  email: string | null
  source: string | null
  stage: string
  subStatus: string | null
  budget: number | null
  location: string | null
  remarks: string | null
  assignedTo: string | null
  created_at: string
  updated_at: string
  visits?: Array<{
    id: string
    scheduledAt: string
    projectSqft: number | null
    projectStatus: string | null
  }>
}

const stageColors: Record<string, string> = {
  NEW: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
  NUMBER_COLLECTED: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200',
  DISCOVERY: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  CAD_PHASE: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  QUOTATION_PHASE: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  BUDGET_PHASE: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
  VISUALIZATION_PHASE: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200',
  CONVERSION: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  CONTACT_ATTEMPTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  NURTURING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  VISIT_SCHEDULED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  VISIT_RESCHEDULED: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200',
  VISIT_COMPLETED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  VISIT_CANCELLED: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  CLOSED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
}

interface LeadInfoCardProps {
  lead: LeadDetails
  stage: string
  hasPendingFollowup: boolean
}

const formatDate = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatLabel = (value: string) => value.replace(/_/g, ' ')

export function LeadInfoCard({ lead, stage, hasPendingFollowup }: LeadInfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-2xl text-foreground">{lead.name}</CardTitle>
            <p className="mt-1 text-muted-foreground">{lead.location || '—'}</p>
            {hasPendingFollowup ? (
              <span className="mt-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                Pending follow-up
              </span>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${stageColors[stage]}`}>
              {stage}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
              {lead.subStatus ? formatLabel(lead.subStatus) : 'No substatus'}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-semibold text-foreground mt-1">{lead.phone || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-semibold text-foreground mt-1 truncate">{lead.email || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Location</p>
              <p className="font-semibold text-foreground mt-1">{lead.location || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <DollarSign className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Budget</p>
              <p className="font-semibold text-foreground mt-1">{lead.budget !== null ? `৳${lead.budget.toLocaleString()}` : '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Project Size</p>
              <p className="font-semibold text-foreground mt-1">
                {lead.visits?.[0]?.projectSqft ? `${lead.visits[0].projectSqft} sqft` : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Project Status</p>
              <p className="font-semibold text-foreground mt-1">
                {lead.visits?.[0]?.projectStatus ? formatLabel(lead.visits[0].projectStatus) : '—'}
              </p>
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">Source</p>
                <p className="font-semibold text-foreground mt-1 capitalize">{lead.source || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-semibold text-foreground mt-1">{formatDate(lead.created_at)}</p>
              </div>
            </div>
          </div>
        </div>
        {lead.remarks && (
          <div className="border-t border-border pt-6 flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground mb-1">Remarks</p>
              <p className="text-foreground">{lead.remarks}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
