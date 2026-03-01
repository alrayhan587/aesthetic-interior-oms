'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Search } from 'lucide-react'

const statuses = ['NEW', 'CONTACTED', 'FOLLOWUP', 'VISIT_SCHEDULED', 'REJECTED', 'CONVERTED']

// Dummy leads data based on Prisma Lead model fields (trimmed for UI)
const sampleLeads = [
  {
    id: 'lead_1',
    name: 'Dhaka Interiors Ltd',
    phone: '+8801712345678',
    email: 'info@dhakainteriors.com.bd',
    source: 'Website',
    status: 'NEW',
    budget: 250000,
    location: 'Dhaka',
    remarks: 'Interested in commercial fitout',
    assignedTo: 'user_1',
    created_at: '2024-02-20T09:12:00Z',
  },
  {
    id: 'lead_2',
    name: 'Chittagong Constructions',
    phone: '+8801812345679',
    email: 'contact@chittagongcons.com.bd',
    source: 'Referral',
    status: 'CONTACTED',
    budget: 120000,
    location: 'Chittagong',
    remarks: 'Requested office layout options',
    assignedTo: 'user_2',
    created_at: '2024-02-18T11:30:00Z',
  },
  {
    id: 'lead_3',
    name: 'Sylhet Traders',
    phone: '+8801912345680',
    email: 'hello@sylhettraders.com.bd',
    source: 'Cold Call',
    status: 'VISIT_SCHEDULED',
    budget: 60000,
    location: 'Sylhet',
    remarks: 'Schedule site visit next week',
    assignedTo: 'user_3',
    created_at: '2024-02-17T14:45:00Z',
  },
  {
    id: 'lead_4',
    name: 'Rajshahi Retailers',
    phone: '+8801712345681',
    email: 'sales@rajshahiretail.com.bd',
    source: 'Event',
    status: 'FOLLOWUP',
    budget: 300000,
    location: 'Rajshahi',
    remarks: 'Follow up after RFP',
    assignedTo: 'user_2',
    created_at: '2024-02-15T08:20:00Z',
  },
  {
    id: 'lead_5',
    name: 'Khulna Hospitality',
    phone: '+8801812345682',
    email: 'info@khulnahotel.com.bd',
    source: 'Website',
    status: 'NEW',
    budget: 450000,
    location: 'Khulna',
    remarks: 'Interested in hospitality package',
    assignedTo: 'user_4',
    created_at: '2024-02-10T10:00:00Z',
  },
  {
    id: 'lead_6',
    name: 'Pabna Enterprise',
    phone: '+8801912345683',
    email: 'contact@pabnaenterprise.com.bd',
    source: 'Referral',
    status: 'CONVERTED',
    budget: 800000,
    location: 'Pabna',
    remarks: 'Converted last month',
    assignedTo: 'user_1',
    created_at: '2024-01-30T09:00:00Z',
  },
  {
    id: 'lead_7',
    name: 'Mymensingh Studio',
    phone: '+8801712345684',
    email: 'studio@mymensingh.co.bd',
    source: 'Inbound',
    status: 'CONTACTED',
    budget: 40000,
    location: 'Mymensingh',
    remarks: 'Early stage budget, discuss modular options',
    assignedTo: 'user_3',
    created_at: '2024-02-22T13:10:00Z',
  },
  {
    id: 'lead_8',
    name: 'Gazipur Developers',
    phone: '+8801812345685',
    email: 'team@gazipurdev.com.bd',
    source: 'Campaign',
    status: 'FOLLOWUP',
    budget: 95000,
    location: 'Gazipur',
    remarks: 'Waiting on client confirmation',
    assignedTo: 'user_2',
    created_at: '2024-02-12T16:50:00Z',
  },
  {
    id: 'lead_9',
    name: 'Narayanganj Supplies',
    phone: '+8801912345686',
    email: 'contact@narayansupplies.com.bd',
    source: 'Cold Call',
    status: 'REJECTED',
    budget: 20000,
    location: 'Narayanganj',
    remarks: 'Budget mismatch',
    assignedTo: null,
    created_at: '2024-01-05T09:30:00Z',
  },
  {
    id: 'lead_10',
    name: 'Cox\'s Bazar Resorts',
    phone: '+8801712345687',
    email: 'reservations@coxresorts.com.bd',
    source: 'Referral',
    status: 'VISIT_SCHEDULED',
    budget: 220000,
    location: 'Cox\'s Bazar',
    remarks: 'Site visit confirmed',
    assignedTo: 'user_4',
    created_at: '2024-02-24T07:45:00Z',
  },
  {
    id: 'lead_11',
    name: 'Comilla Furnishers',
    phone: '+8801812345688',
    email: 'info@comillafurnish.com.bd',
    source: 'Website',
    status: 'NEW',
    budget: 35000,
    location: 'Cumilla',
    remarks: 'Small retail fitout',
    assignedTo: null,
    created_at: '2024-02-23T12:00:00Z',
  },
  {
    id: 'lead_12',
    name: 'Dhaka Metro Services',
    phone: '+8801912345689',
    email: 'office@dhakametro.com.bd',
    source: 'Event',
    status: 'CONTACTED',
    budget: 110000,
    location: 'Dhaka',
    remarks: 'Requested proposal',
    assignedTo: 'user_1',
    created_at: '2024-02-21T15:30:00Z',
  },
]

const statusColors: Record<string, string> = {
  NEW: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
  CONTACTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  FOLLOWUP: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  VISIT_SCHEDULED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  CONVERTED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
}

export default function LeadsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const filteredLeads = sampleLeads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(search.toLowerCase()) ||
      (lead.phone || '').includes(search) ||
      (lead.email || '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'ALL' || lead.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const statusCounts = statuses.reduce((acc, status) => {
    acc[status] = sampleLeads.filter((l) => l.status === status).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leads</h1>
          <p className="mt-1 text-muted-foreground">Manage and track all your leads</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Lead
        </Button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statuses.map((status) => (
          <Card key={status} className="text-center bg-card border-border">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">{statusCounts[status]}</div>
              <p className="mt-1 text-xs text-muted-foreground">{status}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            {statuses.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Leads Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Leads List ({filteredLeads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Lead Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Project Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Location</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="border-b hover:bg-muted/50">
                    <td className="py-4 px-4">
                      <div className="font-medium text-foreground">{lead.name}</div>
                      <div className="text-xs text-muted-foreground">{lead.email}</div>
                    </td>
                    <td className="py-4 px-4">{lead.phone}</td>
                    <td className="py-4 px-4">{/* project_type placeholder */}—</td>
                    <td className="py-4 px-4">{lead.location}</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[lead.status]}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Link href={`/crm/jr/leads/${lead.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
