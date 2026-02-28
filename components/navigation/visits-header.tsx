'use client'

import { Bell, ChevronDown, User } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function VisitsHeader() {
  return (
    <header className="border-b border-slate-800 bg-slate-900 sticky top-0 z-30">
      <div className="flex items-center justify-between px-4 md:px-6 h-16">
        {/* Left Section - Empty (for mobile spacing) */}
        <div className="flex-1" />

        {/* Right Section - User & Notifications */}
        <div className="flex items-center gap-4">
          {/* Notification Bell */}
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-white"
          >
            <Bell size={20} />
          </Button>

          {/* User Profile */}
          <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
            <div className="flex flex-col items-end">
              <p className="text-sm font-medium text-white">Sarah Johnson</p>
              <p className="text-xs text-slate-400">Jr. CRM</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white"
            >
              <ChevronDown size={18} />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
