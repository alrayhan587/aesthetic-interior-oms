import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SeniorCrmDashboardPage() {
  return (
    <div className="min-h-full bg-gradient-to-b from-background via-background to-muted/20">
      <CrmPageHeader
        title="Dashboard"
        subtitle="Senior CRM overview dashboard."
      />

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">This page is under construction.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
