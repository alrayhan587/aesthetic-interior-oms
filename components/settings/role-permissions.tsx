'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, Lock, Info } from 'lucide-react'

type UserRole = 'Admin' | 'CRM Agent' | 'Senior CRM' | 'JR Architect' | '3D Visualizer' | 'Quotation Team'

interface Permission {
  id: string
  name: string
  description: string
  category: string
}

interface RolePermissionMap {
  role: UserRole
  permissions: string[]
  description: string
  color: string
}

const allPermissions: Permission[] = [
  // Lead Management
  { id: 'view_leads', name: 'View Leads', description: 'View all lead information', category: 'Lead Management' },
  { id: 'create_leads', name: 'Create Leads', description: 'Create new leads', category: 'Lead Management' },
  { id: 'edit_leads', name: 'Edit Leads', description: 'Edit lead details and information', category: 'Lead Management' },
  { id: 'delete_leads', name: 'Delete Leads', description: 'Delete leads from system', category: 'Lead Management' },
  { id: 'update_lead_status', name: 'Update Lead Status', description: 'Change lead stage and status', category: 'Lead Management' },

  // Followup Management
  { id: 'view_followups', name: 'View Followups', description: 'View all followup tasks', category: 'Followup Management' },
  { id: 'create_followups', name: 'Create Followups', description: 'Schedule new followups', category: 'Followup Management' },
  { id: 'edit_followups', name: 'Edit Followups', description: 'Edit existing followups', category: 'Followup Management' },
  { id: 'mark_followup_done', name: 'Mark Followup Done', description: 'Mark followups as completed', category: 'Followup Management' },

  // Visit Management
  { id: 'view_visits', name: 'View Visits', description: 'View scheduled visits', category: 'Visit Management' },
  { id: 'schedule_visits', name: 'Schedule Visits', description: 'Create and schedule new visits', category: 'Visit Management' },
  { id: 'update_visit_result', name: 'Update Visit Result', description: 'Update visit outcomes and notes', category: 'Visit Management' },

  // User Management
  { id: 'manage_users', name: 'Manage Users', description: 'Create, edit, delete users', category: 'User Management' },
  { id: 'manage_roles', name: 'Manage Roles', description: 'Manage roles and permissions', category: 'User Management' },
  { id: 'reset_password', name: 'Reset Password', description: 'Reset user passwords', category: 'User Management' },

  // System Management
  { id: 'view_activity_log', name: 'View Activity Log', description: 'View system activity logs', category: 'System Management' },
  { id: 'manage_settings', name: 'Manage Settings', description: 'Access system settings', category: 'System Management' },
  { id: 'manage_integrations', name: 'Manage Integrations', description: 'Configure external integrations', category: 'System Management' },
]

const rolePermissions: RolePermissionMap[] = [
  {
    role: 'Admin',
    description: 'Full system access with all permissions',
    color: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200',
    permissions: [
      'view_leads', 'create_leads', 'edit_leads', 'delete_leads', 'update_lead_status',
      'view_followups', 'create_followups', 'edit_followups', 'mark_followup_done',
      'view_visits', 'schedule_visits', 'update_visit_result',
      'manage_users', 'manage_roles', 'reset_password',
      'view_activity_log', 'manage_settings', 'manage_integrations'
    ]
  },
  {
    role: 'CRM Agent',
    description: 'Can manage leads and followups for assigned accounts',
    color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200',
    permissions: [
      'view_leads', 'create_leads', 'edit_leads', 'update_lead_status',
      'view_followups', 'create_followups', 'edit_followups', 'mark_followup_done',
      'view_visits', 'schedule_visits',
      'view_activity_log'
    ]
  },
  {
    role: 'Senior CRM',
    description: 'Can manage leads, followups, and supervise other CRM agents',
    color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200',
    permissions: [
      'view_leads', 'create_leads', 'edit_leads', 'delete_leads', 'update_lead_status',
      'view_followups', 'create_followups', 'edit_followups', 'mark_followup_done',
      'view_visits', 'schedule_visits', 'update_visit_result',
      'view_activity_log'
    ]
  },
  {
    role: 'JR Architect',
    description: 'Can view leads and create design proposals',
    color: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200',
    permissions: [
      'view_leads', 'view_followups', 'view_visits'
    ]
  },
  {
    role: '3D Visualizer',
    description: 'Can view leads and create 3D visualizations',
    color: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200',
    permissions: [
      'view_leads', 'view_followups', 'view_visits'
    ]
  },
  {
    role: 'Quotation Team',
    description: 'Can view leads and create quotations',
    color: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200',
    permissions: [
      'view_leads', 'view_followups'
    ]
  },
]

const permissionCategories = ['Lead Management', 'Followup Management', 'Visit Management', 'User Management', 'System Management']

export function RolePermissions() {
  const [expandedRole, setExpandedRole] = useState<UserRole | null>('Admin')

  const getRoleColor = (role: UserRole) => {
    const roleData = rolePermissions.find(r => r.role === role)
    return roleData?.color || ''
  }

  const getRolePermissions = (role: UserRole) => {
    const roleData = rolePermissions.find(r => r.role === role)
    return roleData?.permissions || []
  }

  const getRoleDescription = (role: UserRole) => {
    const roleData = rolePermissions.find(r => r.role === role)
    return roleData?.description || ''
  }

  const getPermissionsByCategory = (permissions: string[], category: string) => {
    return allPermissions.filter(p => p.category === category && permissions.includes(p.id))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Role & Permission Settings</CardTitle>
          <CardDescription>Control what each role can access and perform in the system</CardDescription>
        </CardHeader>
      </Card>

      {/* Info Alert */}
      <Card className="border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">Permission Hierarchy</p>
              <p>Permissions are inherited from role definitions. Admin has full access to all features. Edit permissions to control access for other roles.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roles with Permissions */}
      <div className="space-y-4">
        {rolePermissions.map(roleData => (
          <Card key={roleData.role} className="border-border overflow-hidden">
            <div
              onClick={() => setExpandedRole(expandedRole === roleData.role ? null : roleData.role)}
              className="cursor-pointer hover:bg-secondary/50 transition-colors"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <Badge className={roleData.color}>{roleData.role}</Badge>
                    <div>
                      <p className="text-sm text-muted-foreground">{roleData.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{roleData.permissions.length} permissions assigned</p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-muted-foreground transition-transform ${
                      expandedRole === roleData.role ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </CardHeader>
            </div>

            {/* Expanded Content */}
            {expandedRole === roleData.role && (
              <CardContent className="space-y-6 border-t border-border pt-6">
                {permissionCategories.map(category => {
                  const categoryPermissions = getPermissionsByCategory(roleData.permissions, category)
                  if (categoryPermissions.length === 0) return null

                  return (
                    <div key={category}>
                      <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-primary" />
                        {category}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {categoryPermissions.map(permission => (
                          <div
                            key={permission.id}
                            className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/30"
                          >
                            <div className="w-4 h-4 rounded-full bg-green-500 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm text-foreground">{permission.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{permission.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* Restricted Categories */}
                {roleData.role !== 'Admin' && (
                  <div className="border-t border-border pt-6">
                    <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-red-500" />
                      Restricted Features
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {permissionCategories
                        .filter(cat => getPermissionsByCategory(roleData.permissions, cat).length === 0)
                        .flatMap(cat => allPermissions.filter(p => p.category === cat))
                        .slice(0, 6)
                        .map(permission => (
                          <div
                            key={permission.id}
                            className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-secondary/10 opacity-50"
                          >
                            <div className="w-4 h-4 rounded-full bg-red-500/30 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm text-foreground line-through">{permission.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Not available</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-border pt-6 flex gap-2">
                  <Button size="sm" variant="outline">Edit Permissions</Button>
                  <Button size="sm" variant="outline">View Users</Button>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
