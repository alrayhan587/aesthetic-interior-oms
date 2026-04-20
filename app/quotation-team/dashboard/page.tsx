import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function QuotationTeamDashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="Quotation Team Dashboard"
        subtitle="Overview workspace for quotation activities."
      />

      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This dashboard page is ready for upcoming quotation team widgets.
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
