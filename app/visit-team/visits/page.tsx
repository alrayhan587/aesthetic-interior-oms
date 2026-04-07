'use client'

import { VisitsPageView } from '@/app/crm/jr/visits/page'

export default function VisitTeamVisitsPage() {
  return (
    <VisitsPageView
      pageTitle="Visit Team Visits"
      pageSubtitle="Mobile-first visit board with clickable summaries and detailed filters."
      leadHrefPrefix="/visit-team/leads"
      restrictToCreator={false}
      allowCompleteVisit
      blurUnassignedVisitDetails
      visitScope="all"
      allowManageAssignment={false}
      showScheduleButton={false}
      showSummaryDashboard
      cardNavigatesToLead
    />
  )
}
