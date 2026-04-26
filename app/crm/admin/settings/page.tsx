'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Users, 
  Shield, 
  Bell, 
  Activity, 
  Plug,
  SlidersHorizontal,
} from 'lucide-react'
import { UserManagement } from '@/components/settings/user-management'
import { RolePermissions } from '@/components/settings/role-permissions'
import { NotificationSettings } from '@/components/settings/notification-settings'
import { ActivityLog } from '@/components/settings/activity-log'
import { IntegrationSettings } from '@/components/settings/integration-settings'
import { VisitWorkflowSettings } from '@/components/settings/visit-workflow-settings'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('users')

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage users, roles, permissions, and system configuration</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 mb-8">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Roles</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Activity</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2">
              <Plug className="w-4 h-4" />
              <span className="hidden sm:inline">Integration</span>
            </TabsTrigger>
            <TabsTrigger value="visit-workflow" className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Visit Workflow</span>
            </TabsTrigger>
          </TabsList>

          {/* User Management Tab */}
          <TabsContent value="users" className="space-y-6">
            <UserManagement />
          </TabsContent>

          {/* Role & Permissions Tab */}
          <TabsContent value="roles" className="space-y-6">
            <RolePermissions />
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <NotificationSettings />
          </TabsContent>

          {/* Activity Log Tab */}
          <TabsContent value="activity" className="space-y-6">
            <ActivityLog />
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="space-y-6">
            <IntegrationSettings />
          </TabsContent>

          <TabsContent value="visit-workflow" className="space-y-6">
            <VisitWorkflowSettings />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
