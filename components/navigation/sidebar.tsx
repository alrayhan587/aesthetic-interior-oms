'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarClock,
  CheckSquare,
  Moon,
  Sun,
  X,
  Home,
  ListTodo,
  ClipboardList,
  Settings,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/theme-provider'
import { useEffect, useMemo, useState } from 'react'
import { hasVisitTeamLeadershipRole } from '@/lib/visit-team-roles'

interface SidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: string
}

type NavItem = { icon: typeof LayoutDashboard; label: string; href: string }
type NavGroup = { id: string; label: string; items: NavItem[]; defaultOpen?: boolean }

const navigationGroups: Record<string, NavGroup[]> = {
  'JR CRM': [
    {
      id: 'jr-overview',
      label: 'Overview',
      defaultOpen: true,
      items: [{ icon: LayoutDashboard, label: 'Dashboard', href: '/crm/jr/dashboard' }],
    },
    {
      id: 'jr-crm',
      label: 'CRM',
      defaultOpen: true,
      items: [
        { icon: Users, label: 'Leads', href: '/crm/jr/leads' },
        { icon: CheckSquare, label: 'Followups', href: '/crm/jr/followups' },
        { icon: Calendar, label: 'Visits', href: '/crm/jr/visits' },
      ],
    },
  ],
  'Admin': [
    {
      id: 'admin-overview',
      label: 'Overview',
      defaultOpen: true,
      items: [{ icon: LayoutDashboard, label: 'Dashboard', href: '/crm/admin/dashboard' }],
    },
    {
      id: 'admin-crm',
      label: 'CRM',
      defaultOpen: true,
      items: [
        { icon: Users, label: 'Leads', href: '/crm/admin/leads' },
        { icon: Calendar, label: 'Visits', href: '/crm/admin/visits' },
        { icon: ClipboardList, label: 'Visit Queue', href: '/crm/admin/queue' },
        { icon: ListTodo, label: 'Senior Tasks', href: '/crm/admin/today-tasks' },
        { icon: ClipboardList, label: 'CAD Queue', href: '/crm/admin/cad-phase-queue' },
        { icon: CalendarClock, label: 'Senior Calendar', href: '/crm/admin/calendar' },
      ],
    },
    {
      id: 'admin-settings',
      label: 'Settings',
      defaultOpen: false,
      items: [
        { icon: Settings, label: 'Settings', href: '/crm/admin/settings' },
        { icon: Settings, label: 'WhatsApp Monitor', href: '/crm/admin/whatsapp-monitor' },
      ],
    },
  ],
  'Senior CRM': [
    {
      id: 'sr-overview',
      label: 'Overview',
      defaultOpen: true,
      items: [{ icon: LayoutDashboard, label: 'Today To-Do', href: '/crm/sr/dashboard' }],
    },
    {
      id: 'sr-workflow',
      label: 'Workflow',
      defaultOpen: true,
      items: [
        { icon: ClipboardList, label: 'Visit Queue', href: '/crm/sr/queue' },
        { icon: Users, label: 'Lead Journey', href: '/crm/sr/lead-journey' },
        { icon: ClipboardList, label: 'Review Center', href: '/crm/sr/review-center' },
        { icon: ClipboardList, label: 'CAD Queue', href: '/crm/sr/cad-phase-queue' },
        { icon: CalendarClock, label: 'CAD Approved Queue', href: '/crm/sr/cad-approved-queue' },
        { icon: CalendarClock, label: 'Calendar', href: '/crm/sr/meetings' },
        { icon: ClipboardList, label: 'Handoff Center', href: '/crm/sr/handoffs' },
        { icon: CheckSquare, label: 'Conversion & Payment', href: '/crm/sr/conversion-payment' },
      ],
    },
  ],
  'Visit Team': [
    {
      id: 'visit-overview',
      label: 'Overview',
      defaultOpen: true,
      items: [{ icon: Home, label: 'Dashboard', href: '/visit-team/visit-dashboard' }],
    },
    {
      id: 'visit-workflow',
      label: 'Visits',
      defaultOpen: true,
      items: [
        { icon: Calendar, label: 'Visits', href: '/visit-team/visits' },
        { icon: CalendarClock, label: 'Today Visit', href: '/visit-team/visit-today' },
        { icon: ListTodo, label: 'My Visits', href: '/visit-team/my-visits' },
        { icon: ClipboardList, label: 'My Supports', href: '/visit-team/supported-visits' },
      ],
    },
  ],
  'Jr Architect': [
    {
      id: 'jr-arch-overview',
      label: 'Overview',
      defaultOpen: true,
      items: [{ icon: LayoutDashboard, label: 'Dashboard', href: '/crm/jr-architecture/dashboard' }],
    },
    {
      id: 'jr-arch-workflow',
      label: 'Workflow',
      defaultOpen: true,
      items: [
        { icon: ClipboardList, label: 'Visit Queue', href: '/crm/jr-architecture/queue' },
        { icon: ClipboardList, label: 'CAD Queue', href: '/crm/jr-architecture/cad-phase-queue' },
        { icon: Users, label: 'Assigned Leads', href: '/crm/jr-architecture/leads' },
      ],
    },
  ],
  'Quotation Team': [
    {
      id: 'quotation-overview',
      label: 'Overview',
      defaultOpen: true,
      items: [{ icon: LayoutDashboard, label: 'Dashboard', href: '/quotation-team/dashboard' }],
    },
    {
      id: 'quotation-workflow',
      label: 'Workflow',
      defaultOpen: true,
      items: [
        { icon: ClipboardList, label: 'Quotation Queue', href: '/quotation-team/quotation-queue' },
        { icon: ListTodo, label: 'Assigned Task', href: '/quotation-team/assigned-task' },
      ],
    },
  ],
}

export function Sidebar({ open, onOpenChange, role }: SidebarProps) {
  const pathname = usePathname() || ''
  const { theme, toggleTheme } = useTheme()

  const [mounted, setMounted] = useState(false)
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [canViewVisitTeamQueue, setCanViewVisitTeamQueue] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const updateIsLargeScreen = () => setIsLargeScreen(mediaQuery.matches)
    updateIsLargeScreen()
    mediaQuery.addEventListener('change', updateIsLargeScreen)

    return () => {
      mediaQuery.removeEventListener('change', updateIsLargeScreen)
    }
  }, [])

  // true for any route that lives under /visits
  const isVisits = pathname.startsWith('/visit-team')

  const groups = useMemo(() => {
    const baseGroups = isVisits
      ? navigationGroups['Visit Team']
      : navigationGroups[role as keyof typeof navigationGroups] || []

    if (!isVisits) return baseGroups

    return baseGroups.map((group) => {
      if (group.id !== 'visit-overview') return group
      const queueItem = {
        icon: ClipboardList,
        label: 'Visit Schedule Queue',
        href: '/visit-team/visit-schedule-queue',
      }
      const hasQueueItem = group.items.some((item) => item.href === queueItem.href)
      return {
        ...group,
        items:
          canViewVisitTeamQueue && !hasQueueItem
            ? [...group.items, queueItem]
            : group.items,
      }
    })
  }, [canViewVisitTeamQueue, isVisits, role])

  useEffect(() => {
    if (!isVisits) return
    let active = true
    fetch('/api/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null
        const payload = (await response.json()) as {
          userRoles?: Array<{ role?: { name?: string | null } | null }>
        }
        if (!active) return null
        const roleNames = Array.isArray(payload?.userRoles)
          ? payload.userRoles
              .map((entry) => entry?.role?.name)
              .filter((name): name is string => Boolean(name))
          : []
        setCanViewVisitTeamQueue(hasVisitTeamLeadershipRole(roleNames))
        return null
      })
      .catch(() => {
        if (!active) return
        setCanViewVisitTeamQueue(false)
      })

    return () => {
      active = false
    }
  }, [isVisits])

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev }
      let changed = false
      groups.forEach((group) => {
        if (typeof next[group.id] === 'undefined') {
          next[group.id] = group.defaultOpen ?? true
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [groups, isVisits])

  const closeOnSmallScreens = () => {
    if (!isLargeScreen) {
      onOpenChange(false)
    }
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeOnSmallScreens}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen w-64 bg-sidebar text-sidebar-foreground transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
          <div>
            <h1 className="text-lg font-bold">
              OMS System
            </h1>
            <p className="text-xs text-muted-foreground">{role}</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded p-1 hover:bg-sidebar-accent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-2 overflow-y-auto">
          {groups.map((group) => {
              const isOpen = openGroups[group.id]
              return (
                <div key={group.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGroups((prev) => ({
                        ...prev,
                        [group.id]: !prev[group.id],
                      }))
                    }
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform',
                        isOpen ? 'rotate-0' : '-rotate-90'
                      )}
                    />
                  </button>
                  {isOpen && (
                    <div className="space-y-1 pl-1">
                      {group.items.map((item) => {
                        const Icon = item.icon
                        const isActive =
                          pathname === item.href ||
                          pathname.startsWith(item.href + '/')
                        return (
                          <Button
                            key={item.href}
                            asChild
                            variant={isActive ? 'secondary' : 'ghost'}
                            className={cn(
                              'w-full justify-start gap-3',
                              isActive &&
                              'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/90'
                            )}
                          >
                            <Link href={item.href} onClick={closeOnSmallScreens}>
                              <Icon className="w-5 h-5" />
                              {item.label}
                            </Link>
                          </Button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
        </nav>

        {/* Footer – theme toggle only */}
        <div className="space-y-2 border-t border-sidebar-border p-4">
          <div className="w-full flex justify-start items-center gap-1">
            <div
              className="relative inline-flex items-center cursor-pointer w-12 h-6 bg-gray-100 dark:bg-gray-700 rounded-full transition-colors duration-300"
              onClick={toggleTheme}
            >
              {mounted && (
                <div
                  className={`absolute w-5 h-5 bg-white dark:bg-gray-900 rounded-full  transform transition-transform duration-300 flex items-center justify-center 
                  ${theme === 'dark' ? 'translate-x-6 bg-gray-700' : 'translate-x-1'}`}
                >
                  {theme === 'dark' ? (
                    <Moon className="w-3 h-3 text-gray-100" />
                  ) : (
                    <Sun className="w-3 h-3 text-yellow-500" />
                  )}
                </div>)}
            </div>
          </div>
        </div>
      </aside>

      {/* Spacer for desktop */}
      <div
        className={cn(
          'hidden lg:block transition-all duration-300',
          open ? 'w-64' : 'w-0',
        )}
      />
    </>
  )
}
