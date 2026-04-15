import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ensureSrDeadlineAlerts, listSrTaskCards } from '@/lib/sr-task-service'
import { AlertCircle, CalendarClock, ClipboardList, FileText, UserRound } from 'lucide-react'

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
  glowClass: string
} {
  const today = startOfDay(new Date())
  const due = startOfDay(dueAt)
  const dayDiff = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))

  if (dayDiff < 0) {
    return {
      label: 'Overdue Reminder',
      cardClass: 'border-red-300/80 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/30',
      badgeClass: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-200 dark:border-red-800/70',
      glowClass: 'bg-red-400/40 dark:bg-red-500/35',
    }
  }
  if (dayDiff === 0) {
    return {
      label: 'Today Reminder',
      cardClass: 'border-amber-300/80 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-800/70',
      glowClass: 'bg-amber-400/40 dark:bg-amber-500/35',
    }
  }
  return {
    label: 'Upcoming Reminder',
    cardClass: 'border-blue-200/80 bg-blue-50/60 dark:border-blue-900/60 dark:bg-blue-950/25',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-800/70',
    glowClass: 'bg-blue-400/40 dark:bg-blue-500/35',
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
            {todos.map((todo) => {
              const tone = getReminderTone(todo.dueAt)
              return (
                <Card
                  key={todo.id}
                  className={`relative overflow-hidden border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${tone.cardClass}`}
                >
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute left-0 top-0 h-full w-1.5 ${tone.glowClass}`}
                  />
                  <CardContent className="space-y-4 p-4 pl-5 sm:p-5 sm:pl-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-foreground">{todo.leadName}</p>
                          <Badge variant="secondary" className="text-[11px]">
                            {todo.phaseType}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Lead ID: {todo.leadId}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone.badgeClass}`}>
                        {tone.label}
                      </span>
                    </div>

                    <div className="grid gap-2 rounded-xl border border-border/70 bg-background/85 p-3 text-sm md:grid-cols-2">
                      <p className="inline-flex items-center gap-2 text-muted-foreground">
                        <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>
                          Stage:{' '}
                          <span className="font-medium text-foreground">
                            {todo.leadStage}
                            {todo.leadSubStatus ? ` -> ${todo.leadSubStatus}` : ''}
                          </span>
                        </span>
                      </p>
                      <p className="inline-flex items-center gap-2 text-muted-foreground">
                        <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>
                          Worker: <span className="font-medium text-foreground">{todo.workerName}</span>
                        </span>
                      </p>
                      <p className="inline-flex items-center gap-2 text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>
                          Started: <span className="font-medium text-foreground">{formatDateTime(todo.startedAt)}</span>
                        </span>
                      </p>
                      <p className="inline-flex items-center gap-2 text-muted-foreground">
                        <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>
                          Deadline: <span className="font-medium text-foreground">{formatDateTime(todo.dueAt)}</span>
                        </span>
                      </p>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-2">
                      <div className="rounded-xl border border-border/70 bg-background/90 p-3">
                        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <FileText className="h-3.5 w-3.5" />
                          Work Scope
                        </p>
                        <p className="mt-1.5 text-sm text-foreground">
                          {todo.workDetails ?? 'No work details added yet.'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-background/90 p-3">
                        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <ClipboardList className="h-3.5 w-3.5" />
                          Last Note
                        </p>
                        <p className="mt-1.5 text-sm text-foreground">
                          {todo.lastNote ?? 'No note from worker yet.'}
                        </p>
                      </div>
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
