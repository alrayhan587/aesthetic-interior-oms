'use client'

import { CadPhaseQueueBoard } from '@/components/crm/shared/cad-phase-queue-board'

export default function SrCadPhaseQueuePage() {
  return (
    <CadPhaseQueueBoard
      title="CAD Phase Lead Queue"
      subtitle="Leader queue for CAD phase leads with reassignment controls for JR Architects."
      leadBasePath="/crm/sr/leads"
    />
  )
}
