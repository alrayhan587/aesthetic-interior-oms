'use client'

import { CadPhaseQueueBoard } from '@/components/crm/shared/cad-phase-queue-board'

export default function SrCadApprovedQueuePage() {
  return (
    <CadPhaseQueueBoard
      title="CAD Approved Queue"
      subtitle="List of CAD-approved leads in CAD phase. Set the first meeting from here."
      leadBasePath="/crm/sr/leads"
      cadApprovedOnly
    />
  )
}
