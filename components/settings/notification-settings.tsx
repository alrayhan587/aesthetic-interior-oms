'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bell, Mail, MessageSquare, CheckCircle2 } from 'lucide-react'

interface NotificationTrigger {
  id: string
  name: string
  description: string
  enabled: boolean
  channels: {
    inApp: boolean
    email: boolean
    sms: boolean
  }
}

const notificationTriggers: NotificationTrigger[] = [
  {
    id: 'new_lead_assigned',
    name: 'New Lead Assigned',
    description: 'Notify when a new lead is assigned to a user',
    enabled: true,
    channels: { inApp: true, email: true, sms: false }
  },
  {
    id: 'followup_due',
    name: 'Followup Due',
    description: 'Notify when a followup task is coming due',
    enabled: true,
    channels: { inApp: true, email: true, sms: false }
  },
  {
    id: 'visit_scheduled',
    name: 'Visit Scheduled',
    description: 'Notify when a visit is scheduled',
    enabled: true,
    channels: { inApp: true, email: true, sms: false }
  },
  {
    id: 'visit_completed',
    name: 'Visit Completed',
    description: 'Notify when a visit is marked as completed',
    enabled: true,
    channels: { inApp: true, email: false, sms: false }
  },
  {
    id: 'lead_status_changed',
    name: 'Lead Status Changed',
    description: 'Notify when a lead status is updated',
    enabled: true,
    channels: { inApp: true, email: false, sms: false }
  },
  {
    id: 'overdue_followup',
    name: 'Overdue Followup',
    description: 'Notify when a followup is overdue',
    enabled: true,
    channels: { inApp: true, email: true, sms: true }
  },
]

export function NotificationSettings() {
  const [notifications, setNotifications] = useState<NotificationTrigger[]>(notificationTriggers)

  const toggleNotification = (id: string) => {
    setNotifications(notifications.map(n =>
      n.id === id ? { ...n, enabled: !n.enabled } : n
    ))
  }

  const toggleChannel = (id: string, channel: 'inApp' | 'email' | 'sms') => {
    setNotifications(notifications.map(n =>
      n.id === id
        ? { ...n, channels: { ...n.channels, [channel]: !n.channels[channel] } }
        : n
    ))
  }

  const channelIcons = {
    inApp: <Bell className="w-4 h-4" />,
    email: <Mail className="w-4 h-4" />,
    sms: <MessageSquare className="w-4 h-4" />
  }

  const channelLabels = {
    inApp: 'In-App',
    email: 'Email',
    sms: 'SMS'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>Configure system notifications and delivery methods</CardDescription>
        </CardHeader>
      </Card>

      {/* Notifications List */}
      <div className="space-y-4">
        {notifications.map(notification => (
          <Card key={notification.id} className="border-border">
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{notification.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{notification.description}</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notification.enabled}
                      onChange={() => toggleNotification(notification.id)}
                      className="w-4 h-4 rounded border-input"
                    />
                    <span className="text-sm font-medium text-foreground">
                      {notification.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>

                {/* Channels */}
                {notification.enabled && (
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                    {(Object.keys(notification.channels) as Array<'inApp' | 'email' | 'sms'>).map(channel => (
                      <label
                        key={channel}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          notification.channels[channel]
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-input bg-background text-muted-foreground hover:border-input/80'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={notification.channels[channel]}
                          onChange={() => toggleChannel(notification.id, channel)}
                          className="w-4 h-4"
                        />
                        <div className="flex items-center gap-1.5">
                          {channelIcons[channel]}
                          <span className="text-sm font-medium">{channelLabels[channel]}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary */}
      <Card className="border-border bg-secondary/30">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Enabled</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {notifications.filter(n => n.enabled).length}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email Enabled</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {notifications.filter(n => n.channels.email).length}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">SMS Enabled</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {notifications.filter(n => n.channels.sms).length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
