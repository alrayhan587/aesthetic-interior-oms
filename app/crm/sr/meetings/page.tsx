import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SeniorCrmMeetingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="Meetings"
        subtitle="Manage first meetings, budget meetings, and client follow-through."
      />

      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Meeting Workflow</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Driven by lead substatus values: FIRST_MEETING_SET and BUDGET_MEETING_SET.
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
