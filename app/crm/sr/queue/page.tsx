import { VisitCompleteQueueBoard } from '@/components/crm/shared/visit-complete-queue-board'

export default function SeniorCrmQueuePage() {
  return (
    <VisitCompleteQueueBoard
      title="Visit Complete Queue"
      subtitle="Assign Junior Architects or approve their requests for visit-completed leads."
      leadHrefPrefix="/crm/sr/leads"
    />
  )
}
