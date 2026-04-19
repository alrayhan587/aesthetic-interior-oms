import { LeadAssignmentDepartment, Prisma } from '@/generated/prisma/client'

const SCOPED_DEPARTMENTS: LeadAssignmentDepartment[] = [
  LeadAssignmentDepartment.JR_CRM,
  LeadAssignmentDepartment.SR_CRM,
]

export function scopedAssignmentDepartments(userDepartments: string[]): LeadAssignmentDepartment[] {
  const set = new Set(userDepartments)

  return SCOPED_DEPARTMENTS.filter((department) => set.has(department))
}

export function buildScopedLeadWhere(input: {
  leadId?: string
  actorUserId: string
  actorDepartments: string[]
}): Prisma.LeadWhereInput {
  const scopedDepartments = scopedAssignmentDepartments(input.actorDepartments)
  const isAdmin = input.actorDepartments.includes('ADMIN')
  const isVisitTeam = input.actorDepartments.includes('VISIT_TEAM')

  const idClause = input.leadId ? { id: input.leadId } : {}

  if (isAdmin) {
    return idClause
  }

  if (scopedDepartments.length === 0 && !isVisitTeam) {
    return {
      ...idClause,
      id: '__no_access__',
    }
  }

  const accessClauses: Prisma.LeadWhereInput[] = []

  if (scopedDepartments.length > 0) {
    accessClauses.push({
      assignments: {
        some: {
          userId: input.actorUserId,
          department: { in: scopedDepartments },
        },
      },
    })
  }

  if (isVisitTeam) {
    accessClauses.push({
      visits: {
        some: {
          OR: [
            { assignedToId: input.actorUserId },
            {
              supportAssignments: {
                some: {
                  supportUserId: input.actorUserId,
                },
              },
            },
          ],
        },
      },
    })
    accessClauses.push({
      assignments: {
        some: {
          userId: input.actorUserId,
          department: LeadAssignmentDepartment.VISIT_TEAM,
        },
      },
    })
  }

  return {
    ...idClause,
    OR: accessClauses,
  }
}
