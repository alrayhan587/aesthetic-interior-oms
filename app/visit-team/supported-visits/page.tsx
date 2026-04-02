'use client'

import { VisitHistoryView } from '@/components/visit-team/visit-history-view'

export default function SupportedVisitsPage() {
  return (
    <VisitHistoryView
      mode="support"
      title="My Supports"
      subtitle="Track every visit where you acted as a support member."
      emptyPastText="No completed/past support visits found for the selected filters."
      emptyUpcomingText="No upcoming support assignments for the current filters."
    />
  )
}
