'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type LeadDetail = {
  id: string
  name: string
  stage: string
  subStatus: string | null
  location: string | null
  phone: string | null
  meetingEvents?: Array<{
    id: string
    title: string
    type: string
    notes: string | null
    startsAt: string
  }>
}

export default function QuotationLeadDetailsPage() {
  const params = useParams<{ id: string }>()
  const leadId = params?.id
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lead, setLead] = useState<LeadDetail | null>(null)

  useEffect(() => {
    const loadLead = async () => {
      if (!leadId) return
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/lead/${leadId}`, { cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok || !payload?.success || !payload?.data) {
          throw new Error(payload?.error ?? 'Failed to load lead')
        }
        setLead(payload.data as LeadDetail)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load lead')
        setLead(null)
      } finally {
        setLoading(false)
      }
    }

    void loadLead()
  }, [leadId])

  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title={lead ? `${lead.name} - Meeting Data` : 'Lead Meeting Data'}
        subtitle="Lead page for quotation workflow with meeting summary and notes."
      />

      <main className="mx-auto max-w-[1000px] px-6 py-6 space-y-4">
        {loading ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">Loading lead...</CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : lead ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Lead Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><span className="font-medium">Name:</span> {lead.name}</p>
                <p><span className="font-medium">Phone:</span> {lead.phone ?? 'N/A'}</p>
                <p><span className="font-medium">Location:</span> {lead.location ?? 'N/A'}</p>
                <p><span className="font-medium">Stage:</span> {lead.stage}</p>
                <p><span className="font-medium">Sub-status:</span> {lead.subStatus ?? 'N/A'}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Meeting History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(lead.meetingEvents ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No meeting events found for this lead.</p>
                ) : (
                  (lead.meetingEvents ?? []).map((meeting) => (
                    <div key={meeting.id} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">{meeting.title}</p>
                      <p className="text-muted-foreground">
                        {meeting.type.replace(/_/g, ' ')} • {new Date(meeting.startsAt).toLocaleString()}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap">{meeting.notes ?? 'No notes'}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </main>
    </div>
  )
}
