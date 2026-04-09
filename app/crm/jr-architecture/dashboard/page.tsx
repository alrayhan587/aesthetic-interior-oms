import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const runtime = 'nodejs'
export const preferredRegion = 'sin1'

export default async function JrArchitectureDashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/')

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      fullName: true,
      userDepartments: {
        select: {
          department: {
            select: { name: true },
          },
        },
      },
    },
  })

  if (!user || user.userDepartments.length === 0) redirect('/onboarding')

  const isJrArchitect = user.userDepartments.some((row) => row.department.name === 'JR_ARCHITECT')
  if (!isJrArchitect) redirect('/')

  const [openCadTasks, reviewCadTasks, overdueCadTasks, recentLeads] = await Promise.all([
    prisma.leadPhaseTask.count({
      where: {
        assigneeUserId: user.id,
        phaseType: 'CAD',
        status: { in: ['OPEN', 'IN_REVIEW'] },
      },
    }),
    prisma.leadPhaseTask.count({
      where: {
        assigneeUserId: user.id,
        phaseType: 'CAD',
        status: 'IN_REVIEW',
      },
    }),
    prisma.leadPhaseTask.count({
      where: {
        assigneeUserId: user.id,
        phaseType: 'CAD',
        status: { in: ['OPEN', 'IN_REVIEW'] },
        dueAt: { lt: new Date() },
      },
    }),
    prisma.leadPhaseTask.findMany({
      where: {
        assigneeUserId: user.id,
        phaseType: 'CAD',
      },
      include: {
        lead: {
          select: { id: true, name: true, stage: true, subStatus: true },
        },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 5,
    }),
  ])

  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="Junior Architect Dashboard"
        subtitle="Your CAD queue, priorities, and active lead work."
      />

      <main className="mx-auto max-w-[1440px] px-6 py-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Open CAD Tasks</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{openCadTasks}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">In Review</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{reviewCadTasks}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Overdue</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{overdueCadTasks}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Assigned Leads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No CAD leads assigned yet.</p>
            ) : (
              recentLeads.map((task) => (
                <div key={task.id} className="rounded-lg border p-3">
                  <p className="text-sm font-semibold">{task.lead.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Stage: {task.lead.stage}
                    {task.lead.subStatus ? ` -> ${task.lead.subStatus}` : ''}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Deadline: {task.dueAt.toLocaleDateString('en-US')}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
