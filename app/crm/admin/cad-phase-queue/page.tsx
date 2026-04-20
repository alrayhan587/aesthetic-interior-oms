'use client'

import { CadPhaseQueueBoard } from '@/components/crm/shared/cad-phase-queue-board'

export default function AdminCadPhaseQueuePage() {
  return (
    <CadPhaseQueueBoard
      title="CAD Phase Lead Queue (Admin)"
      subtitle="Admin view of all CAD phase leads with JR Architect reassignment controls."
      leadBasePath="/crm/admin/leads"
    />
  )
}
