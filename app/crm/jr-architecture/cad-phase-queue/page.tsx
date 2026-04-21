import { CadPhaseQueueBoard } from '@/components/crm/shared/cad-phase-queue-board'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { hasJrArchitectureLeaderRole } from '@/lib/jr-architecture-roles'

export default async function JrArchitectureCadPhaseQueuePage() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/')
  }

  const actor = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      userDepartments: {
        select: {
          department: {
            select: { name: true },
          },
        },
      },
      userRoles: {
        select: {
          role: {
            select: { name: true },
          },
        },
      },
    },
  })

  const departmentNames = new Set(
    (actor?.userDepartments ?? []).map((row) => row.department.name),
  )
  const roleNames = (actor?.userRoles ?? []).map((row) => row.role.name)
  const canAccessCadQueue =
    departmentNames.has('ADMIN') ||
    departmentNames.has('SR_CRM') ||
    (departmentNames.has('JR_ARCHITECT') &&
      hasJrArchitectureLeaderRole(roleNames))

  if (!canAccessCadQueue) {
    redirect('/crm/jr-architecture/dashboard')
  }

  return (
    <CadPhaseQueueBoard
      title="CAD Phase Lead Queue"
      subtitle="JR Architect leader view for all CAD phase leads with reassignment controls."
      leadBasePath="/crm/jr-architecture/leads"
    />
  )
}
