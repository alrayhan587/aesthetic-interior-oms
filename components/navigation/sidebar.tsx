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
import { useEffect, useState } from 'react'

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
        { icon: Users, label: 'Lead Journey', href: '/crm/sr/lead-journey' },
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
        { icon: CalendarClock, label: 'Visit Schedule', href: '/visit-team/visit-today' },
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
        { icon: Users, label: 'Assigned Leads', href: '/crm/jr-architecture/leads' },
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

  const groups = isVisits
    ? navigationGroups['Visit Team']
    : navigationGroups[role as keyof typeof navigationGroups] || []

  useEffect(() => {
    if (isVisits) return
    setOpenGroups((prev) => {
      const next = { ...prev }
      groups.forEach((group) => {
        if (typeof next[group.id] === 'undefined') {
          next[group.id] = group.defaultOpen ?? true
        }
      })
      return next
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
                      'flex w-full items-center justify-between rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-sidebar-accent'
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
                          <Link key={item.href} href={item.href} onClick={closeOnSmallScreens}>
                            <Button
                              variant={isActive ? 'secondary' : 'ghost'}
                              className={cn(
                                'w-full justify-start gap-3',
                                isActive &&
                                'bg-primary text-primary-foreground hover:bg-primary/90'
                              )}
                            >
                              <Icon className="w-5 h-5" />
                              {item.label}
                            </Button>
                          </Link>
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
