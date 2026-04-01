'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Calendar,
  CheckSquare,
  Moon,
  Sun,
  X,
  Home,
  ListTodo,
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
      items: [{ icon: Users, label: 'Leads', href: '/crm/admin/leads' }],
    },
    {
      id: 'admin-settings',
      label: 'Settings',
      defaultOpen: false,
      items: [{ icon: Settings, label: 'Settings', href: '/crm/admin/settings' }],
    },
  ],
}

const visitsNavItems = [
  { icon: Home, label: 'Dashboard', href: '/visit-team/visit-dashboard' },
  { icon: Calendar, label: 'Visits', href: '/visit-team/visits' },
  { icon: Calendar, label: 'Visit Schedule', href: '/visit-team/visit-today' },
  { icon: ListTodo, label: 'My Visits', href: '/visit-team/my-visits' },
]

export function Sidebar({ open, onOpenChange, role }: SidebarProps) {
  const pathname = usePathname() || ''
  const { theme, toggleTheme } = useTheme()

  const [mounted, setMounted] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setMounted(true)
  }, [])

  // true for any route that lives under /visits
  const isVisits = pathname.startsWith('/visit-team')

  const groups = isVisits
    ? []
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

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen w-64 bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0',
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
            className="lg:hidden rounded p-1 hover:bg-sidebar-accent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-2 overflow-y-auto">
          {isVisits ? (
            visitsNavItems.map((item) => {
              const Icon = item.icon
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link key={item.href} href={item.href}>
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
            })
          ) : (
            groups.map((group) => {
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
                          <Link key={item.href} href={item.href}>
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
            })
          )}
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
      <div className="hidden lg:block w-64" />
    </>
  )
}
