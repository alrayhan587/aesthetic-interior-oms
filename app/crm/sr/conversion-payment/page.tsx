import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SeniorCrmConversionAndPaymentPage() {
  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="Conversion & Payment"
        subtitle="Payment statuses are restricted to Senior CRM, Accounts, and Admin with audit logging."
      />

      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Payment Governance</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            CLIENT_CONFIRMED, CLIENT_PARTIALLY_PAID, and CLIENT_FULL_PAID are permission-checked and logged.
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
