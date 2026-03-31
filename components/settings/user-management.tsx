'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Plus, Power, RefreshCw, Search } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type UserApiItem = {
  id: string
  fullName: string
  email: string
  isActive: boolean
  userDepartments: Array<{
    department: {
      name: string
    }
  }>
}

type UsersResponse = UserApiItem[] | { error?: string }

function getDepartmentLabel(user: UserApiItem): string {
  const names = user.userDepartments
    .map((item) => item.department?.name?.trim() ?? '')
    .filter((name) => name.length > 0)
  return names[0] ?? 'Unassigned'
}

export function UserManagement() {
  const [users, setUsers] = useState<UserApiItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDepartment, setFilterDepartment] = useState<'all' | string>('all')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [togglingIds, setTogglingIds] = useState<Record<string, boolean>>({})

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setStatusError(null)
    try {
      const response = await fetch('/api/user', { cache: 'no-store' })
      const payload = (await response.json()) as UsersResponse
      if (!response.ok || !Array.isArray(payload)) {
        throw new Error(!Array.isArray(payload) ? payload.error ?? 'Failed to load users' : 'Failed to load users')
      }
      setUsers(payload)
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const departmentOptions = useMemo(() => {
    const set = new Set<string>()
    users.forEach((user) => {
      set.add(getDepartmentLabel(user))
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [users])

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return users.filter((user) => {
      const matchesSearch =
        query.length === 0 ||
        user.fullName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
      const department = getDepartmentLabel(user)
      const matchesDepartment = filterDepartment === 'all' || department === filterDepartment
      return matchesSearch && matchesDepartment
    })
  }, [filterDepartment, searchQuery, users])

  const toggleUserStatus = async (user: UserApiItem) => {
    setStatusMessage(null)
    setStatusError(null)
    setTogglingIds((prev) => ({ ...prev, [user.id]: true }))

    try {
      const response = await fetch(`/api/user/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to update user status')
      }

      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id
            ? {
                ...item,
                isActive: !user.isActive,
              }
            : item,
        ),
      )
      setStatusMessage(
        `${user.fullName} is now ${user.isActive ? 'inactive' : 'active'}.`,
      )
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Failed to update user status')
    } finally {
      setTogglingIds((prev) => ({ ...prev, [user.id]: false }))
    }
  }

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="py-8 text-sm text-muted-foreground">Loading users...</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Name, email, role (department), and active status controls for lead auto-assignment.
              </CardDescription>
            </div>
            <Button className="gap-2" disabled>
              <Plus className="w-4 h-4" />
              Add User
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterDepartment} onValueChange={setFilterDepartment}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Filter by department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departmentOptions.map((department) => (
              <SelectItem key={department} value={department}>
                {department}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" className="gap-2" onClick={() => void loadUsers()}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Name</th>
                <th className="hidden px-6 py-3 text-left text-sm font-semibold text-foreground md:table-cell">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Role (Department)</th>
                <th className="hidden px-6 py-3 text-left text-sm font-semibold text-foreground md:table-cell">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-secondary/30">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-foreground">{user.fullName}</p>
                      <p className="text-xs text-muted-foreground md:hidden">{user.email}</p>
                    </div>
                  </td>
                  <td className="hidden px-6 py-4 text-sm text-muted-foreground md:table-cell">{user.email}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{getDepartmentLabel(user)}</td>
                  <td className="hidden px-6 py-4 md:table-cell">
                    <Badge variant={user.isActive ? 'default' : 'secondary'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={Boolean(togglingIds[user.id])}
                      onClick={() => void toggleUserStatus(user)}
                    >
                      <Power className="h-3.5 w-3.5" />
                      <span className="hidden text-xs sm:inline">
                        {user.isActive ? 'Disable' : 'Enable'}
                      </span>
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    No users found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(statusMessage || statusError) && (
        <Card className={statusError ? 'border-red-200 bg-red-50/70' : 'border-green-200 bg-green-50/70'}>
          <CardContent className={`pt-6 text-sm ${statusError ? 'text-red-700' : 'text-green-700'}`}>
            {statusError ?? statusMessage}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
