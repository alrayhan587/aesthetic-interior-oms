import { Lead, LeadPrimaryOwnerDepartment } from '@/generated/prisma/client'

export function isAdminDepartment(actorDepartments: string[]): boolean {
  return actorDepartments.includes('ADMIN')
}

export function isSrOrAdmin(actorDepartments: string[]): boolean {
  return actorDepartments.includes('SR_CRM') || isAdminDepartment(actorDepartments)
}

export function canManagePrimaryLeadFlow(input: {
  actorUserId: string
  actorDepartments: string[]
  lead: Pick<Lead, 'primaryOwnerUserId'>
}): boolean {
  if (isAdminDepartment(input.actorDepartments)) return true
  if (!input.lead.primaryOwnerUserId) return true
  return input.lead.primaryOwnerUserId === input.actorUserId
}

export function inferPrimaryOwnerDepartment(input: {
  hasJrAssignee: boolean
  hasSrAssignee: boolean
}): LeadPrimaryOwnerDepartment | null {
  if (input.hasJrAssignee) return LeadPrimaryOwnerDepartment.JR_CRM
  if (input.hasSrAssignee) return LeadPrimaryOwnerDepartment.SR_CRM
  return null
}
