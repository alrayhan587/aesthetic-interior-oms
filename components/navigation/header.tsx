'use client'

import { Menu, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'
import { NotificationBell } from '@/components/navigation/notification-bell'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname() || ''
  const isVisits = pathname.startsWith('/visits')

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const headerClasses = cn(
    'flex h-16 items-center justify-between px-6',
    isVisits
      ? 'border-b border-slate-800 bg-slate-900'
      : 'border-b border-border bg-background'
  )

  return (
    <header className={headerClasses}>
      {/** keep the mobile menu trigger in both modes */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="lg:hidden"
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* push right‑hand controls to edge (visits header had an empty flex-1) */}
      {isVisits && <div className="flex-1" />}

      <div className="flex items-center gap-4 ml-auto">
        <SignedOut>
          <SignInButton forceRedirectUrl="/onboarding">
            <Button variant="ghost" className="text-sm">Sign In</Button>
          </SignInButton>
          <SignUpButton forceRedirectUrl="/onboarding">
            <Button className="bg-[#6c47ff] hover:bg-[#5936d9] text-white text-sm">Sign Up</Button>
          </SignUpButton>
        </SignedOut>

        <SignedIn>
          <NotificationBell />
          <UserButton/>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SignedIn>
      </div>
    </header>
  )
}
