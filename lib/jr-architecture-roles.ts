export const JR_ARCHITECT_LEADER_ROLE = 'JR_ARCHITECT_LEADER'
export const JR_ARCHITECT_CO_LEADER_ROLE = 'JR_ARCHITECT_CO_LEADER'

export const JR_ARCHITECT_LEADERSHIP_ROLES = [
  JR_ARCHITECT_LEADER_ROLE,
  JR_ARCHITECT_CO_LEADER_ROLE,
] as const

export function hasJrArchitectureLeadershipRole(roleNames: string[] | null | undefined): boolean {
  if (!Array.isArray(roleNames) || roleNames.length === 0) return false
  const normalized = new Set(roleNames.map((role) => role.trim().toUpperCase()))
  return JR_ARCHITECT_LEADERSHIP_ROLES.some((roleName) => normalized.has(roleName))
}

export function hasJrArchitectureLeaderRole(roleNames: string[] | null | undefined): boolean {
  if (!Array.isArray(roleNames) || roleNames.length === 0) return false
  const normalized = new Set(roleNames.map((role) => role.trim().toUpperCase()))
  return normalized.has(JR_ARCHITECT_LEADER_ROLE)
}
