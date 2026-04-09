import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NotificationType } from '@/generated/prisma/client'
import { SR_CAD_REVIEW_TODO_TITLE } from '@/lib/sr-cad-todo'

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

  const liveTodos = await prisma.notification.findMany({
    where: {
      userId: actor.id,
      type: NotificationType.LEAD_ASSIGNED_TO_YOU,
      title: SR_CAD_REVIEW_TODO_TITLE,
    },
    include: {
      lead: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const dummyTodo = {
    id: 'dummy-cad-review-001',
    title: SR_CAD_REVIEW_TODO_TITLE,
    message:
      'Check lead Fahim Residence CAD work. Reason: Rafi (JR Architect) started architect work on 2026-04-09.',
    createdAt: new Date('2026-04-09T09:30:00.000Z'),
    lead: { id: 'DEMO-LEAD-001', name: 'Fahim Residence' },
    isDummy: true,
  }

  const todos = [dummyTodo, ...liveTodos.map((item) => ({ ...item, isDummy: false }))]

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
                  <p className="text-sm font-semibold">{todo.title}</p>
                  {todo.isDummy ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Dummy
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{todo.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Lead: {todo.lead?.name ?? 'Unknown'} | Created: {formatDateTime(todo.createdAt)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
