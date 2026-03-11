'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Power,
  RotateCcw,
  Search,
  Filter,
  ChevronDown,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type UserRole = 'Admin' | 'CRM Agent' | 'Senior CRM' | 'JR Architect' | '3D Visualizer' | 'Quotation Team'
type UserStatus = 'active' | 'inactive'

interface User {
  id: string
  name: string
  email: string
  role: UserRole
  department: string
  status: UserStatus
  createdAt: string
  lastLogin?: string
}

const mockUsers: User[] = [
  {
    id: '1',
    name: 'Md Al Raihan',
    email: 'mdalraihan450@gmail.com',
    role: 'Admin',
    department: 'Management',
    status: 'active',
    createdAt: '2024-01-15',
    lastLogin: '2026-03-11 14:30',
  },
  {
    id: '2',
    name: 'Mahi Chowdhury',
    email: 'mahi.chowdhury@company.com',
    role: 'CRM Agent',
    department: 'Sales',
    status: 'active',
    createdAt: '2024-02-20',
    lastLogin: '2026-03-11 13:15',
  },
  {
    id: '3',
    name: 'Tajrian Nice',
    email: 'tajrian@company.com',
    role: 'Senior CRM',
    department: 'Sales',
    status: 'active',
    createdAt: '2024-01-10',
    lastLogin: '2026-03-10 16:45',
  },
  {
    id: '4',
    name: 'Rafat Khan',
    email: 'rafat.khan@company.com',
    role: 'JR Architect',
    department: 'Design',
    status: 'active',
    createdAt: '2024-02-01',
    lastLogin: '2026-03-11 09:20',
  },
  {
    id: '5',
    name: 'Sarah Ahmed',
    email: 'sarah.ahmed@company.com',
    role: '3D Visualizer',
    department: 'Design',
    status: 'inactive',
    createdAt: '2024-03-05',
  },
  {
    id: '6',
    name: 'Hassan Khan',
    email: 'hassan@company.com',
    role: 'Quotation Team',
    department: 'Operations',
    status: 'active',
    createdAt: '2024-02-15',
    lastLogin: '2026-03-09 11:00',
  },
]

const roles: UserRole[] = ['Admin', 'CRM Agent', 'Senior CRM', 'JR Architect', '3D Visualizer', 'Quotation Team']

const roleColors: Record<UserRole, string> = {
  'Admin': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  'CRM Agent': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  'Senior CRM': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  'JR Architect': 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  '3D Visualizer': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  'Quotation Team': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200',
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = filterRole === 'all' || user.role === filterRole
    return matchesSearch && matchesRole
  })

  const toggleUserStatus = (id: string) => {
    setUsers(users.map(user =>
      user.id === id ? { ...user, status: user.status === 'active' ? 'inactive' : 'active' } : user
    ))
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage all users, roles, and permissions</CardDescription>
            </div>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add User
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background"
          />
        </div>
        <Select value={filterRole} onValueChange={(value) => setFilterRole(value as UserRole | 'all')}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {roles.map(role => (
              <SelectItem key={role} value={role}>{role}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden border border-border rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-sm text-foreground">Name</th>
                <th className="text-left px-6 py-3 font-semibold text-sm text-foreground hidden md:table-cell">Email</th>
                <th className="text-left px-6 py-3 font-semibold text-sm text-foreground hidden lg:table-cell">Role</th>
                <th className="text-left px-6 py-3 font-semibold text-sm text-foreground hidden lg:table-cell">Department</th>
                <th className="text-left px-6 py-3 font-semibold text-sm text-foreground hidden md:table-cell">Status</th>
                <th className="text-left px-6 py-3 font-semibold text-sm text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground md:hidden">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground hidden md:table-cell">{user.email}</td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <Badge className={roleColors[user.role]}>{user.role}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground hidden lg:table-cell">{user.department}</td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                      {user.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => toggleUserStatus(user.id)}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline text-xs">{user.status === 'active' ? 'Disable' : 'Enable'}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline text-xs">Edit</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline text-xs">Reset</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <Card className="border-border bg-secondary/30">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Users</p>
              <p className="text-2xl font-bold text-foreground mt-1">{filteredUsers.length}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{filteredUsers.filter(u => u.status === 'active').length}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Inactive</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{filteredUsers.filter(u => u.status === 'inactive').length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
