import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ensureSrDeadlineAlerts, listSrTaskCards } from '@/lib/sr-task-service'

function formatDateTime(value: Date | null): string {
  if (!value) return 'N/A'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}

function startOfDay(value: Date): Date {
  const clone = new Date(value)
  clone.setHours(0, 0, 0, 0)
  return clone
}

function getReminderTone(dueAt: Date): {
  label: string
  cardClass: string
  badgeClass: string
} {
  const today = startOfDay(new Date())
  const due = startOfDay(dueAt)
  const dayDiff = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))

  if (dayDiff < 0) {
    return {
      label: 'Overdue Reminder',
      cardClass: 'border-red-300 bg-red-50/60',
      badgeClass: 'bg-red-100 text-red-800 border-red-200',
    }
  }
  if (dayDiff === 0) {
    return {
      label: 'Today Reminder',
      cardClass: 'border-amber-300 bg-amber-50/60',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    }
  }
  return {
    label: 'Upcoming Reminder',
    cardClass: 'border-blue-200 bg-blue-50/40',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
  }
}

export default async function AdminSeniorTasksTodayPage() {
  const { userId } = await auth()
  if (!userId) redirect('/')

  const actor = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      userDepartments: {
        select: { department: { select: { name: true } } },
      },
    },
  })

  if (!actor) redirect('/onboarding')
  const isAdmin = actor.userDepartments.some((row) => row.department.name === 'ADMIN')
  if (!isAdmin) redirect('/crm/sr/dashboard')

  await ensureSrDeadlineAlerts()

  const todayTasks = await listSrTaskCards({
    actorUserId: actor.id,
    isAdmin: true,
    myLeadsOnly: false,
    todayOnly: true,
  })

  const unassignedSrCount = todayTasks.filter((task) => !task.srAssigneeUserId).length

  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="Senior CRM Today To-Do (Admin)"
        subtitle="All Senior CRM due reminders for today, including leads without SR assignment."
      />

      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Today Tasks</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{todayTasks.length}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Without SR Assignment</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{unassignedSrCount}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Assigned to SR</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{todayTasks.length - unassignedSrCount}</CardContent>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Task List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                No Senior CRM reminders for today.
              </div>
            ) : null}

            {todayTasks.map((task) => {
              const tone = getReminderTone(task.dueAt)
              return (
                <Card
                  key={task.id}
                  className={`overflow-hidden border-border/70 shadow-sm transition hover:shadow-md ${tone.cardClass}`}
                >
                  <CardContent className="space-y-4 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-base font-semibold text-foreground">{task.leadName}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.phaseType} Reminder • Lead ID: {task.leadId}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone.badgeClass}`}
                      >
                        {tone.label}
                      </span>
                    </div>

                    <div className="grid gap-2 rounded-lg border border-border/60 bg-background/75 p-3 text-sm md:grid-cols-2">
                      <p className="text-muted-foreground">
                        Stage:{' '}
                        <span className="font-medium text-foreground">
                          {task.leadStage}
                          {task.leadSubStatus ? ` -> ${task.leadSubStatus}` : ''}
                        </span>
                      </p>
                      <p className="text-muted-foreground">
                        JR Worker: <span className="font-medium text-foreground">{task.workerName}</span>
                      </p>
                      <p className="text-muted-foreground">
                        SR Owner:{' '}
                        <span className="font-medium text-foreground">
                          {task.srAssigneeName ?? 'Unassigned (admin only)'}
                        </span>
                      </p>
                      <p className="text-muted-foreground">
                        Deadline: <span className="font-medium text-foreground">{formatDateTime(task.dueAt)}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Visit Completed:{' '}
                        <span className="font-medium text-foreground">{formatDateTime(task.sourceVisitCompletedAt)}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Visit Location:{' '}
                        <span className="font-medium text-foreground">{task.sourceVisitLocation ?? 'N/A'}</span>
                      </p>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Work Scope</p>
                      <p className="mt-1 text-sm text-foreground">{task.workDetails ?? 'No work details added yet.'}</p>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visit Summary</p>
                      <p className="mt-1 text-sm text-foreground">{task.sourceVisitSummary ?? 'No visit summary found.'}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
