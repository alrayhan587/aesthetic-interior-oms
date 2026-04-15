import { VisitCompleteQueueBoard } from '@/components/crm/shared/visit-complete-queue-board'

export default function AdminVisitCompleteQueuePage() {
  return (
    <VisitCompleteQueueBoard
      title="Visit Complete Queue (Admin)"
      subtitle="View all visit-completed leads, approve JR requests, and assign the CAD owner."
      leadHrefPrefix="/crm/admin/leads"
    />
  )
}
