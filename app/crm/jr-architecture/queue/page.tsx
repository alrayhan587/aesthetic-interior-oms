import { VisitCompleteQueueBoard } from '@/components/crm/shared/visit-complete-queue-board'

export default function JrArchitectureQueuePage() {
  return (
    <VisitCompleteQueueBoard
      title="Visit Complete Queue"
      subtitle="Read-only queue of visit-completed leads. Request to work on the ones you want to handle."
      leadHrefPrefix={null}
    />
  )
}
