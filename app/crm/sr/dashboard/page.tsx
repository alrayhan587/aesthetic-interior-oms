import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DEFAULT_CAD_WORK_DETAILS,
  ensureSrDeadlineAlerts,
  listSrTaskCards,
} from '@/lib/sr-task-service'

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
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

  const dummyTodo = {
    id: 'dummy-cad-review-001',
    leadId: 'DEMO-LEAD-001',
    leadName: 'Fahim',
    leadStage: 'CAD_PHASE',
    leadSubStatus: 'CAD_WORKING',
    phaseType: 'CAD',
    workDetails: DEFAULT_CAD_WORK_DETAILS,
    workerUserId: 'DEMO-WORKER-001',
    workerName: 'User Name working on that',
    startedAt: new Date('2025-12-04T09:30:00.000Z'),
    dueAt: new Date('2025-12-07T09:30:00.000Z'),
    status: 'OPEN',
    completedAt: null,
    lastSrActionAt: null,
    lastNote: 'Client is good',
    lastNoteAt: new Date('2025-12-04T10:00:00.000Z'),
    createdAt: new Date('2026-04-09T09:30:00.000Z'),
    isDummy: true,
  }

  const todos =
    liveTodos.length > 0
      ? liveTodos.map((item) => ({ ...item, isDummy: false }))
      : [dummyTodo]

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
            <CardContent className="text-2xl font-semibold">{todos.length}</CardContent>
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
            {todos.map((todo) => (
              <div key={todo.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{todo.leadName} - {todo.phaseType}</p>
                  {todo.isDummy ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Dummy
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Stage: {todo.leadStage}
                  {todo.leadSubStatus ? ` -> ${todo.leadSubStatus}` : ''}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Work: {todo.workDetails ?? 'No work details added yet.'}</p>
                <p className="mt-1 text-sm text-muted-foreground">Started: {formatDateTime(todo.startedAt)} | Worker: {todo.workerName}</p>
                <p className="mt-1 text-sm text-muted-foreground">Deadline: {formatDateTime(todo.dueAt)} | Status: {todo.status}</p>
                <p className="mt-1 text-sm text-muted-foreground">Last Note: {todo.lastNote ?? 'No note from worker yet.'}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Lead ID: {todo.leadId}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
