'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  AlertCircle,
  CheckCircle2,
  Link2,
  ExternalLink,
  Settings,
  Info,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react'

interface Integration {
  id: string
  name: string
  description: string
  category: string
  status: 'connected' | 'disconnected' | 'error'
  apiKey?: string
  lastSynced?: string
  icon: string
}

const integrations: Integration[] = [
  {
    id: 'facebook_graph',
    name: 'Facebook Graph API',
    description: 'Connect to Facebook for lead generation and audience insights',
    category: 'Social Media',
    status: 'connected',
    lastSynced: '2026-03-11 10:30 AM',
    icon: '📱'
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp / Call System',
    description: 'Integrated messaging and calling for customer communication',
    category: 'Communication',
    status: 'disconnected',
    icon: '💬'
  },
  {
    id: 'email_server',
    name: 'Email Server',
    description: 'Configure SMTP server for automated email notifications',
    category: 'Email',
    status: 'connected',
    lastSynced: '2026-03-11 14:45 AM',
    icon: '📧'
  },
  {
    id: 'sms_gateway',
    name: 'SMS Gateway',
    description: 'SMS notifications and customer messaging',
    category: 'SMS',
    status: 'disconnected',
    icon: '📲'
  },
  {
    id: 'google_analytics',
    name: 'Google Analytics',
    description: 'Track user behavior and conversion metrics',
    category: 'Analytics',
    status: 'error',
    icon: '📊'
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Real-time notifications and alerts to Slack channels',
    category: 'Communication',
    status: 'disconnected',
    icon: '💼'
  },
]

const categories = ['Social Media', 'Communication', 'Email', 'SMS', 'Analytics']

const statusConfig = {
  connected: {
    color: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200',
    icon: <CheckCircle2 className="w-4 h-4" />,
    label: 'Connected',
  },
  disconnected: {
    color: 'bg-gray-100 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200',
    icon: <Link2 className="w-4 h-4" />,
    label: 'Disconnected',
  },
  error: {
    color: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200',
    icon: <AlertCircle className="w-4 h-4" />,
    label: 'Error',
  },
}

export function IntegrationSettings() {
  const [integrationList, setIntegrationList] = useState<Integration[]>(integrations)
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({})

  const toggleApiKey = (id: string) => {
    setShowApiKey(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Integration Settings</CardTitle>
              <CardDescription>Connect external services and APIs to enhance functionality</CardDescription>
            </div>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Integration
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Info Alert */}
      <Card className="border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">API Keys & Credentials</p>
              <p>Keep your API keys secure. Never share them with anyone. Rotate keys regularly for security.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integrations by Category */}
      <div className="space-y-6">
        {categories.map(category => {
          const categoryIntegrations = integrationList.filter(i => i.category === category)
          return (
            <div key={category} className="space-y-4">
              <h3 className="font-semibold text-foreground text-lg">{category}</h3>
              {categoryIntegrations.map(integration => {
                const status = statusConfig[integration.status]
                return (
                  <Card key={integration.id} className="border-border overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4 flex-1">
                            <div className="text-2xl">{integration.icon}</div>
                            <div className="flex-1">
                              <p className="font-semibold text-foreground">{integration.name}</p>
                              <p className="text-sm text-muted-foreground mt-1">{integration.description}</p>
                              {integration.lastSynced && (
                                <p className="text-xs text-muted-foreground mt-2">Last synced: {integration.lastSynced}</p>
                              )}
                            </div>
                          </div>
                          <Badge className={status.color}>
                            {status.icon}
                            <span className="ml-1">{status.label}</span>
                          </Badge>
                        </div>

                        {/* API Key Section */}
                        {integration.status === 'connected' && integration.apiKey && (
                          <div className="border-t border-border pt-4">
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                              API Key
                            </div>
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 border border-border/50">
                              <input
                                type={showApiKey[integration.id] ? 'text' : 'password'}
                                value={integration.apiKey}
                                readOnly
                                className="flex-1 bg-transparent text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none"
                              />
                              <button
                                onClick={() => toggleApiKey(integration.id)}
                                className="p-1 hover:bg-secondary rounded"
                              >
                                {showApiKey[integration.id] ? (
                                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <Eye className="w-4 h-4 text-muted-foreground" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="border-t border-border pt-4 flex gap-2">
                          {integration.status === 'connected' ? (
                            <>
                              <Button size="sm" variant="outline" className="gap-1">
                                <Settings className="w-3.5 h-3.5" />
                                Configure
                              </Button>
                              <Button size="sm" variant="outline" className="gap-1">
                                <RotateCcw className="w-3.5 h-3.5" />
                                Sync Now
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Disconnect
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" className="gap-1">
                                <Link2 className="w-3.5 h-3.5" />
                                Connect
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="gap-1"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Learn More
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <Card className="border-border bg-secondary/30">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total</p>
              <p className="text-2xl font-bold text-foreground mt-1">{integrationList.length}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Connected</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {integrationList.filter(i => i.status === 'connected').length}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Issues</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {integrationList.filter(i => i.status === 'error').length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Helper component (would need to import from lucide-react in real project)
function RotateCcw(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M3 21v-5h5"/>
    </svg>
  )
}
