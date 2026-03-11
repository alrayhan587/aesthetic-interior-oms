'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Toggle } from '@/components/ui/toggle'
import { 
  Activity, 
  Users, 
  CheckSquare, 
  AlertCircle,
  Zap,
  Eye,
  Edit3,
  Trash2
} from 'lucide-react'

interface LogSetting {
  id: string
  name: string
  description: string
  category: string
  enabled: boolean
  icon: React.ReactNode
}

const logSettings: LogSetting[] = [
  {
    id: 'lead_created',
    name: 'Lead Created',
    description: 'Log when new leads are created',
    category: 'Lead Management',
    enabled: true,
    icon: <Activity className="w-4 h-4" />
  },
  {
    id: 'lead_status_changed',
    name: 'Lead Status Changed',
    description: 'Log when lead status/stage is updated',
    category: 'Lead Management',
    enabled: true,
    icon: <Zap className="w-4 h-4" />
  },
  {
    id: 'lead_edited',
    name: 'Lead Edited',
    description: 'Log when lead information is modified',
    category: 'Lead Management',
    enabled: true,
    icon: <Edit3 className="w-4 h-4" />
  },
  {
    id: 'lead_deleted',
    name: 'Lead Deleted',
    description: 'Log when leads are deleted',
    category: 'Lead Management',
    enabled: true,
    icon: <Trash2 className="w-4 h-4" />
  },
  {
    id: 'followup_created',
    name: 'Followup Created',
    description: 'Log when new followups are scheduled',
    category: 'Followup Management',
    enabled: true,
    icon: <CheckSquare className="w-4 h-4" />
  },
  {
    id: 'followup_completed',
    name: 'Followup Completed',
    description: 'Log when followups are marked complete',
    category: 'Followup Management',
    enabled: true,
    icon: <CheckSquare className="w-4 h-4" />
  },
  {
    id: 'visit_scheduled',
    name: 'Visit Scheduled',
    description: 'Log when visits are scheduled',
    category: 'Visit Management',
    enabled: true,
    icon: <Activity className="w-4 h-4" />
  },
  {
    id: 'visit_updated',
    name: 'Visit Updated',
    description: 'Log when visit details are changed',
    category: 'Visit Management',
    enabled: true,
    icon: <Edit3 className="w-4 h-4" />
  },
  {
    id: 'user_login',
    name: 'User Login',
    description: 'Log all user login attempts',
    category: 'User Management',
    enabled: true,
    icon: <Users className="w-4 h-4" />
  },
  {
    id: 'user_created',
    name: 'User Created',
    description: 'Log when new users are added',
    category: 'User Management',
    enabled: true,
    icon: <Users className="w-4 h-4" />
  },
  {
    id: 'user_role_changed',
    name: 'User Role Changed',
    description: 'Log when user roles are modified',
    category: 'User Management',
    enabled: true,
    icon: <Zap className="w-4 h-4" />
  },
  {
    id: 'permission_changed',
    name: 'Permission Changed',
    description: 'Log when permissions are modified',
    category: 'User Management',
    enabled: true,
    icon: <AlertCircle className="w-4 h-4" />
  },
  {
    id: 'settings_changed',
    name: 'Settings Changed',
    description: 'Log when system settings are modified',
    category: 'System Management',
    enabled: true,
    icon: <Zap className="w-4 h-4" />
  },
  {
    id: 'integration_configured',
    name: 'Integration Configured',
    description: 'Log when integrations are set up',
    category: 'System Management',
    enabled: true,
    icon: <Activity className="w-4 h-4" />
  },
]

const categories = ['Lead Management', 'Followup Management', 'Visit Management', 'User Management', 'System Management']

export function ActivityLog() {
  const [logs, setLogs] = useState<LogSetting[]>(logSettings)

  const toggleLog = (id: string) => {
    setLogs(logs.map(log =>
      log.id === id ? { ...log, enabled: !log.enabled } : log
    ))
  }

  const toggleCategory = (category: string, enabled: boolean) => {
    setLogs(logs.map(log =>
      log.category === category ? { ...log, enabled } : log
    ))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Activity Log Settings</CardTitle>
          <CardDescription>Control which actions are logged in the system activity log</CardDescription>
        </CardHeader>
      </Card>

      {/* Category Toggles */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Quick Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {categories.map(category => {
            const categoryLogs = logs.filter(l => l.category === category)
            const allEnabled = categoryLogs.every(l => l.enabled)
            return (
              <label
                key={category}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/30 cursor-pointer transition-colors"
              >
                <span className="font-medium text-foreground">{category}</span>
                <input
                  type="checkbox"
                  checked={allEnabled}
                  onChange={(e) => toggleCategory(category, e.target.checked)}
                  className="w-4 h-4 rounded border-input"
                />
              </label>
            )
          })}
        </CardContent>
      </Card>

      {/* Individual Log Settings */}
      <div className="space-y-4">
        {categories.map(category => {
          const categoryLogs = logs.filter(l => l.category === category)
          return (
            <Card key={category} className="border-border">
              <CardHeader>
                <CardTitle className="text-base">{category}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryLogs.map(log => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between p-3 rounded-lg border border-border/50 hover:bg-secondary/20 transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg mt-0.5 flex-shrink-0 ${
                        log.enabled 
                          ? 'bg-primary/10 text-primary' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {log.icon}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{log.name}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{log.description}</p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer ml-3 flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={log.enabled}
                        onChange={() => toggleLog(log.id)}
                        className="w-4 h-4 rounded border-input"
                      />
                      <span className="text-sm font-medium text-muted-foreground min-w-fit">
                        {log.enabled ? 'Logging' : 'Off'}
                      </span>
                    </label>
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Summary */}
      <Card className="border-border bg-secondary/30">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Logs</p>
              <p className="text-2xl font-bold text-foreground mt-1">{logs.length}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{logs.filter(l => l.enabled).length}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Disabled</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{logs.filter(l => !l.enabled).length}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Categories</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{categories.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
