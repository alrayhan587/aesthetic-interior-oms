'use client'

import { useEffect, useMemo, useState } from 'react'
import { UserCircle2 } from 'lucide-react'
import { fetchMeCached } from '@/lib/client-me'

type CrmPageHeaderProps = {
  title: string
  subtitle: string
}

export function CrmPageHeader({ title, subtitle }: CrmPageHeaderProps) {
  const [initials, setInitials] = useState('CRM')

  useEffect(() => {
    let active = true
    fetchMeCached()
      .then((data) => {
        if (!active) return
        const fullName = typeof data?.fullName === 'string' ? data.fullName.trim() : ''
        if (!fullName) return
        const chars = fullName
          .split(/\s+/)
          .slice(0, 2)
          .map((segment: string) => segment[0]?.toUpperCase() ?? '')
          .join('')
        if (chars) setInitials(chars)
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [])

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }),
    [],
  )

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{todayLabel}</span>
          <div className="inline-flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            {initials === 'CRM' ? <UserCircle2 className="size-5" /> : <span className="text-xs font-semibold">{initials}</span>}
          </div>
        </div>
      </div>
    </header>
  )
}
