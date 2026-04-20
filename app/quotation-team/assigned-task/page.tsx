import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function QuotationAssignedTaskPage() {
  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="Assigned Task"
        subtitle="Workflow page for tasks assigned to quotation team members."
      />

      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Assigned Task List</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Assigned task page scaffold created. Task actions will be implemented in a future update.
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
