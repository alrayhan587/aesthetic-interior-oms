import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SeniorCrmHandoffsPage() {
  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="Handoff Center"
        subtitle="Auto-handoff states for CAD, Quotation, 3D, and Accounts are active."
      />

      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Auto Handoff Rules</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            CAD_ASSIGNED, QUOTATION_ASSIGNED, VISUAL_ASSIGNED, and payment statuses now trigger department assignment.
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
