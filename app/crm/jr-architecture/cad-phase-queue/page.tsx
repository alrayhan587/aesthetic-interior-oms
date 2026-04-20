'use client'

import { CadPhaseQueueBoard } from '@/components/crm/shared/cad-phase-queue-board'

export default function JrArchitectureCadPhaseQueuePage() {
  return (
    <CadPhaseQueueBoard
      title="CAD Phase Lead Queue"
      subtitle="JR Architect leader view for all CAD phase leads with reassignment controls."
      leadBasePath="/crm/jr-architecture/leads"
    />
  )
}
