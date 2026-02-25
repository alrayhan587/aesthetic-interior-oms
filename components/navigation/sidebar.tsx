'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Calendar,
  CheckSquare,
  LogOut,
  Moon,
  Sun,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/components/theme-provider'

interface SidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: string
}

const navigationItems = {
  'JR CRM': [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/crm/jr/dashboard' },
    { icon: Users, label: 'Leads', href: '/crm/jr/leads' },
    { icon: CheckSquare, label: 'Followups', href: '/crm/jr/followups' },
    { icon: Calendar, label: 'Visits', href: '/crm/jr/visits' },
  ],
}

export function Sidebar({ open, onOpenChange, role }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const items = navigationItems[role as keyof typeof navigationItems] || []

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-30 h-screen w-64 bg-sidebar text-sidebar-foreground transition-transform duration-300 md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
          <h1 className="text-lg font-bold">OMS System</h1>
          <button
            onClick={() => onOpenChange(false)}
            className="md:hidden rounded p-1 hover:bg-sidebar-accent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-2 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full justify-start gap-3',
                    isActive && 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Button>
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="space-y-2 border-t border-sidebar-border p-4">
          {/* Replace the theme Button with this custom toggle */}
          <div className="w-full flex justify-start items-center gap-1">
            {/* <span className="mr-2 text-sm text-muted-foreground">Theme</span> */}
            <div
              className="relative inline-flex items-center cursor-pointer w-12 h-6 bg-gray-100 dark:bg-gray-700 rounded-full transition-colors duration-300"
              onClick={toggleTheme}
            >
              <div
                className={`absolute w-5 h-5 bg-white dark:bg-gray-900 rounded-full  transform transition-transform duration-300 flex items-center justify-center 
                  ${theme === 'dark' ? 'translate-x-6 bg-gray-700' : 'translate-x-1'}`}
              >
                {theme === 'dark' ? (
                  <Moon className="w-3 h-3 text-gray-100" />
                ) : (
                  <Sun className="w-3 h-3 text-yellow-500" />
                )}
              </div>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start gap-3 text-red-500 hover:bg-sidebar-accent hover:text-red-500"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Spacer for desktop */}
      <div className="hidden md:block w-64" />
    </>
  )
}
