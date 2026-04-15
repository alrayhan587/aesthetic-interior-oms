'use client'

import { SeniorCrmMeetingsView } from '@/app/crm/sr/meetings/page'

export default function AdminSeniorCalendarPage() {
  return (
    <SeniorCrmMeetingsView
      title="Senior CRM Calendar (Admin)"
      subtitle="Calendar view of all Senior CRM meetings and task deadlines, including unassigned SR items."
      initialMyLeadsOnly={false}
      lockMyLeadsOnly
    />
  )
}
