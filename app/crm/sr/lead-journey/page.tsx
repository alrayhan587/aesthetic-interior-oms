import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SeniorCrmLeadJourneyPage() {
  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="Lead Journey Board"
        subtitle="Track stage and substatus movement across JR CRM, Architect, Quotation, 3D, Visit, and Accounts."
      />

      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Cross-Department Journey</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Use lead list and detail pages to update the new lifecycle states and handoff statuses.
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
