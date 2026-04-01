'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type StarBorderProps = {
  children: ReactNode
  className?: string
  innerClassName?: string
}

export function StarBorder({ children, className, innerClassName }: StarBorderProps) {
  return (
    <div className={cn('relative inline-block overflow-hidden rounded-md p-[1px]', className)}>
      <div className="pointer-events-none absolute inset-0 rounded-md bg-[conic-gradient(from_0deg,rgba(255,255,255,0.15),rgba(255,215,120,0.95),rgba(255,255,255,0.15),rgba(120,215,255,0.95),rgba(255,255,255,0.15))] animate-[spin_3s_linear_infinite]" />
      <div className={cn('relative rounded-[calc(var(--radius)-1px)]', innerClassName)}>{children}</div>
    </div>
  )
}
