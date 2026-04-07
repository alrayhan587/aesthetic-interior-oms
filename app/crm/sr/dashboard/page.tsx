import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SeniorCrmDashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="Senior CRM Dashboard"
        subtitle="Cross-department lead pipeline, blockers, and payment readiness."
      />

      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Discovery In Progress</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">Live</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">CAD/Quotation Handoffs</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">Tracked</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Budget & Payments</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">Monitored</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Conversion Pipeline</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">Active</CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
