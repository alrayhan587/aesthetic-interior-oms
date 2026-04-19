export const VISIT_TEAM_LEADER_ROLE = 'VISIT_TEAM_LEADER'
export const VISIT_TEAM_CO_LEADER_ROLE = 'VISIT_TEAM_CO_LEADER'

export const VISIT_TEAM_LEADERSHIP_ROLES = [
  VISIT_TEAM_LEADER_ROLE,
  VISIT_TEAM_CO_LEADER_ROLE,
] as const

export function hasVisitTeamLeadershipRole(roleNames: string[] | null | undefined): boolean {
  if (!Array.isArray(roleNames) || roleNames.length === 0) return false
  const normalized = new Set(roleNames.map((role) => role.trim().toUpperCase()))
  return VISIT_TEAM_LEADERSHIP_ROLES.some((roleName) => normalized.has(roleName))
}

