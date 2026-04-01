'use client'

import { useState } from 'react'
import { Header } from '@/components/navigation/header'
import { Sidebar } from '@/components/navigation/sidebar'

interface MainLayoutProps {
  children: React.ReactNode
  /** optional role string – this is only used by the sidebar when not in
      “visit‑team” mode */
  role?: string
}

export function MainLayout({
  children,
  role = 'JR CRM',
}: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background">
      {/* shared sidebar – it determines its own links based on pathname */}
      <Sidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        role={role}
      />

      {/* main column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen((o) => !o)} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
