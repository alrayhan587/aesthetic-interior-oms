'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Phone, Mail, MapPin, DollarSign, FileText, Clock } from 'lucide-react'

type LeadDetails = {
  id: string
  name: string
  phone: string | null
  email: string
  source: string | null
  stage: string
  subStatus: string | null
  budget: number | null
  location: string | null
  remarks: string | null
  assignedTo: string | null
  created_at: string
  updated_at: string
}

const stageColors: Record<string, string> = {
  NEW: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
  CONTACT_ATTEMPTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  NURTURING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  VISIT_SCHEDULED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  CLOSED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
}

interface LeadInfoCardProps {
  lead: LeadDetails
  stage: string
}

export function LeadInfoCard({ lead, stage }: LeadInfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-2xl text-foreground">{lead.name}</CardTitle>
            <p className="mt-1 text-muted-foreground">{lead.location || '—'}</p>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${stageColors[stage]}`}>
            {stage}
          </span>
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
              <p className="font-semibold text-foreground mt-1 truncate">{lead.email}</p>
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
                <p className="font-semibold text-foreground mt-1">{new Date(lead.created_at).toLocaleDateString()}</p>
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
