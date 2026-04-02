'use client'

import { VisitHistoryView } from '@/components/visit-team/visit-history-view'

export default function MyVisitsPage() {
  return (
    <VisitHistoryView
      mode="lead"
      title="My Visits"
      subtitle="Your lead visits timeline with filters and performance snapshots."
      emptyPastText="No completed/past lead visits found for the selected filters."
      emptyUpcomingText="No upcoming lead visits for the current filters."
    />
  )
}
