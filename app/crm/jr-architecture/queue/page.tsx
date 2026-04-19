import { VisitCompleteQueueBoard } from '@/components/crm/shared/visit-complete-queue-board'

export default function JrArchitectureQueuePage() {
  return (
    <VisitCompleteQueueBoard
      title="Visit Complete Queue"
      subtitle="Leaders can assign JR Architects, approve requests, or self-assign. Members can request to work."
      leadHrefPrefix={null}
    />
  )
}
