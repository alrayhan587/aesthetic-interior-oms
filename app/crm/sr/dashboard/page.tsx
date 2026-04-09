import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ensureSrDeadlineAlerts, listSrTaskCards } from '@/lib/sr-task-service'

function formatDateTime(value: Date): string {
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

export default async function SeniorCrmDashboardPage() {
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
  const isSeniorCrm = actor.userDepartments.some((row) => row.department.name === 'SR_CRM')
  if (!isSeniorCrm) redirect('/crm/sr')

  await ensureSrDeadlineAlerts()

  const liveTodos = await listSrTaskCards({
    actorUserId: actor.id,
    isAdmin: false,
    myLeadsOnly: true,
    todayOnly: true,
  })

  const todos = liveTodos

  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="Senior CRM Today To-Do"
        subtitle="First assignment view: review CAD starts and monitor handoff progress."
      />

      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Today To-Do</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{liveTodos.length}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Live CAD Review Items</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{liveTodos.length}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Default Assignment Mode</CardTitle>
            </CardHeader>
            <CardContent className="text-sm font-medium">
              Weekly Senior CRM rotation (admin can override)
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Incoming Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todos.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                No to-do reminders for today.
              </div>
            ) : null}
            {todos.map((todo) => (
              <div
                key={todo.id}
                className={`rounded-xl border p-4 shadow-sm ${getReminderTone(todo.dueAt).cardClass}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {todo.leadName} - {todo.phaseType} Reminder
                  </p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getReminderTone(todo.dueAt).badgeClass}`}
                  >
                    {getReminderTone(todo.dueAt).label}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                  <p>
                    <span className="font-medium text-foreground">Stage:</span> {todo.leadStage}
                    {todo.leadSubStatus ? ` -> ${todo.leadSubStatus}` : ''}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Worker:</span> {todo.workerName}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Started:</span> {formatDateTime(todo.startedAt)}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Deadline:</span> {formatDateTime(todo.dueAt)}
                  </p>
                </div>

                <div className="mt-3 rounded-md border border-border/70 bg-background/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Work Scope</p>
                  <p className="mt-1 text-sm text-foreground">{todo.workDetails ?? 'No work details added yet.'}</p>
                </div>

                <div className="mt-2 rounded-md border border-border/70 bg-background/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last Note</p>
                  <p className="mt-1 text-sm text-foreground">{todo.lastNote ?? 'No note from worker yet.'}</p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                    Lead ID: {todo.leadId}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
