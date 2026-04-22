'use client'

import { CadPhaseQueueBoard } from '@/components/crm/shared/cad-phase-queue-board'

export default function SrCadApprovedQueuePage() {
  return (
    <CadPhaseQueueBoard
      title="Meeting Queue"
      subtitle="CAD approved leads for first-meeting scheduling and meeting-data follow-up."
      leadBasePath="/crm/sr/leads"
      cadApprovedOnly
    />
  )
}
