import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function QuotationQueuePage() {
  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="Quotation Queue"
        subtitle="Workflow page for incoming quotation requests."
      />

      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Queue</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Quotation queue page scaffold created. Business logic and data will be added later.
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
