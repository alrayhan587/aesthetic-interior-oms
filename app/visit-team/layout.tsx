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
    <div className="flex h-screen bg-slate-950">
      <VisitsSidebar />
      <div className="flex-1 flex flex-col md:ml-0 ml-0">
        <VisitsHeader />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
