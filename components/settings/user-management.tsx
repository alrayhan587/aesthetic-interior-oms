'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Building2, Mail, Power, RefreshCw, Search, UserCheck, UserX, Users2 } from 'lucide-react'

type UserApiItem = {
  id: string
  fullName: string
  email: string
  isActive: boolean
}

type AdminUserApiItem = {
  id: string
  fullName: string
  email: string
  isActive: boolean
  created_at?: string
  userDepartments?: Array<{
    department?: {
      id?: string
      name?: string
    } | null
  }>
}

type DepartmentApiItem = {
  id: string
  name: string
  description?: string | null
}
type DepartmentsResponse = {
  success?: boolean
  data?: DepartmentApiItem[]
  error?: string
}

type DepartmentUsersResponse = {
  success?: boolean
  data?: {
    users?: UserApiItem[]
  }
  error?: string
}

export function UserManagement() {
  const [departments, setDepartments] = useState<
    Array<{ key: string; name: string; users: UserApiItem[] }>
  >([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [togglingIds, setTogglingIds] = useState<Record<string, boolean>>({})
  const [pendingUsers, setPendingUsers] = useState<AdminUserApiItem[]>([])
  const [approvalDepartmentByUser, setApprovalDepartmentByUser] = useState<Record<string, string>>({})
  const [openApproveByUser, setOpenApproveByUser] = useState<Record<string, boolean>>({})
  const [approvingIds, setApprovingIds] = useState<Record<string, boolean>>({})

  const loadData = useCallback(async () => {
    setLoading(true)
    setStatusError(null)
    try {
      const departmentsResponse = await fetch('/api/department', { cache: 'no-store' })

      const departmentsPayload = (await departmentsResponse.json()) as DepartmentsResponse
      if (!departmentsResponse.ok || !departmentsPayload.success || !Array.isArray(departmentsPayload.data)) {
        throw new Error(departmentsPayload.error ?? 'Failed to load departments')
      }

      const departmentRows = departmentsPayload.data
      const usersResponse = await fetch('/api/user', { cache: 'no-store' })
      const usersPayload = (await usersResponse.json()) as AdminUserApiItem[] | { error?: string }
      if (!usersResponse.ok || !Array.isArray(usersPayload)) {
        const message =
          typeof usersPayload === 'object' && usersPayload !== null && 'error' in usersPayload
            ? usersPayload.error
            : 'Failed to load users'
        throw new Error(message || 'Failed to load users')
      }

      const pending = usersPayload.filter((user) => {
        const departments = Array.isArray(user.userDepartments) ? user.userDepartments : []
        return departments.length === 0 && user.isActive
      })
      setPendingUsers(pending)

      const usersByDepartment = await Promise.all(
        departmentRows.map(async (department) => {
          const response = await fetch(`/api/department/${department.id}/users`, { cache: 'no-store' })
          const payload = (await response.json()) as DepartmentUsersResponse
          if (!response.ok || !payload.success) {
            throw new Error(payload.error ?? `Failed to load users for ${department.name}`)
          }

          return {
            key: department.id,
            name: department.name,
            users: Array.isArray(payload.data?.users) ? payload.data.users : [],
          }
        }),
      )

      setDepartments(usersByDepartment)
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Failed to load user/department data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const departmentSections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return departments.map((department) => {
      const sectionUsers = department.users.filter((user) => {
        return (
          query.length === 0 ||
          user.fullName.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
        )
      })

      return {
        key: department.key,
        name: department.name,
        users: sectionUsers,
      }
    })
  }, [departments, searchQuery])

  const summary = useMemo(() => {
    const allUsers = departmentSections.flatMap((section) => section.users)
    const uniqueUsers = Array.from(new Map(allUsers.map((user) => [user.id, user])).values())
    const active = uniqueUsers.filter((user) => user.isActive).length
    return {
      totalDepartments: departmentSections.length,
      totalUsers: uniqueUsers.length,
      activeUsers: active,
      inactiveUsers: uniqueUsers.length - active,
    }
  }, [departmentSections])

  const getInitials = (name: string) => {
    const parts = name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    if (parts.length === 0) return 'U'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }

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

      setDepartments((prev) =>
        prev.map((item) =>
          item.users.some((sectionUser) => sectionUser.id === user.id)
            ? {
                ...item,
                users: item.users.map((sectionUser) =>
                  sectionUser.id === user.id
                    ? { ...sectionUser, isActive: !user.isActive }
                    : sectionUser,
                ),
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

  const approvePendingUser = async (user: AdminUserApiItem) => {
    const selectedDepartmentId = approvalDepartmentByUser[user.id]
    if (!selectedDepartmentId) {
      setStatusError(`Select a department before approving ${user.fullName}.`)
      return
    }

    const department = departments.find((item) => item.key === selectedDepartmentId)
    if (!department) {
      setStatusError('Selected department is invalid.')
      return
    }

    setStatusMessage(null)
    setStatusError(null)
    setApprovingIds((prev) => ({ ...prev, [user.id]: true }))
    try {
      const response = await fetch(`/api/user/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentNames: [department.name],
          isActive: true,
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? `Failed to approve ${user.fullName}`)
      }

      setStatusMessage(`${user.fullName} approved and assigned to ${department.name}.`)
      await loadData()
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : `Failed to approve ${user.fullName}`)
    } finally {
      setApprovingIds((prev) => ({ ...prev, [user.id]: false }))
    }
  }

  const rejectPendingUser = async (user: AdminUserApiItem) => {
    setStatusMessage(null)
    setStatusError(null)
    setApprovingIds((prev) => ({ ...prev, [user.id]: true }))
    try {
      const response = await fetch(`/api/user/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: false,
          departmentNames: [],
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? `Failed to reject ${user.fullName}`)
      }

      setStatusMessage(`${user.fullName} rejected. Account is blocked until admin enables it.`)
      await loadData()
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : `Failed to reject ${user.fullName}`)
    } finally {
      setApprovingIds((prev) => ({ ...prev, [user.id]: false }))
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
      <Card className="border-border bg-gradient-to-r from-slate-50 to-stone-50 dark:from-slate-950 dark:to-zinc-950">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">User Management</CardTitle>
              <CardDescription>
                Organized by department with clear status control for assignment workflow.
              </CardDescription>
            </div>
            <Button variant="outline" className="gap-2" onClick={() => void loadData()}>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Pending Approval Requests</CardTitle>
          <CardDescription>
            New signups are listed here until an admin assigns their department.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingUsers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
              No pending signup requests.
            </div>
          ) : (
            pendingUsers.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{user.fullName}</p>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {openApproveByUser[user.id] ? (
                    <>
                      <Select
                        value={approvalDepartmentByUser[user.id] ?? ''}
                        onValueChange={(value) =>
                          setApprovalDepartmentByUser((prev) => ({ ...prev, [user.id]: value }))
                        }
                      >
                        <SelectTrigger className="w-full sm:w-[220px]">
                          <SelectValue placeholder="Assign department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((department) => (
                            <SelectItem key={department.key} value={department.key}>
                              {department.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void approvePendingUser(user)}
                        disabled={Boolean(approvingIds[user.id])}
                      >
                        {approvingIds[user.id] ? 'Approving...' : 'Approve'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          setOpenApproveByUser((prev) => ({ ...prev, [user.id]: true }))
                        }
                        disabled={Boolean(approvingIds[user.id])}
                      >
                        Yes
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void rejectPendingUser(user)}
                        disabled={Boolean(approvingIds[user.id])}
                      >
                        {approvingIds[user.id] ? 'Saving...' : 'No'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="border-border">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Departments</p>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold">{summary.totalDepartments}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Users</p>
              <Users2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold">{summary.totalUsers}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active</p>
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-emerald-600">{summary.activeUsers}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Inactive</p>
              <UserX className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-amber-600">{summary.inactiveUsers}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {departmentSections.map((section) => (
          <Card key={section.key} className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-secondary p-2">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{section.name}</CardTitle>
                    <CardDescription>Department user roster</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary">{section.users.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.users.length === 0 && (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  No users found in this department.
                </div>
              )}

              {section.users.map((user) => (
                <div
                  key={`${section.key}-${user.id}`}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                      {getInitials(user.fullName)}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{user.fullName}</p>
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        {user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={user.isActive ? 'default' : 'secondary'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={Boolean(togglingIds[user.id])}
                      onClick={() => void toggleUserStatus(user)}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {user.isActive ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {departmentSections.length === 0 && (
        <Card className="border-border">
          <CardContent className="py-8 text-sm text-muted-foreground">
            No departments found. Create departments first, then assign users.
          </CardContent>
        </Card>
      )}

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
