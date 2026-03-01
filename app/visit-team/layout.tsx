import { MainLayout } from '@/components/layout/mainlayout'
import { VisitsHeader } from '@/components/navigation/visits-header'
import { VisitsSidebar } from '@/components/navigation/visits-sidebar'


export const metadata = {
  title: 'Visit Scheduler | CRM',
  description: 'Manage and track visits',
}

export default function VisitsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MainLayout role="Visit Team">
      {children}
    </MainLayout>
  )
}
