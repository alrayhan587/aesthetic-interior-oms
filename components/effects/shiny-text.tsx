'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type ShinyTextProps = {
  children: ReactNode
  className?: string
}

export function ShinyText({ children, className }: ShinyTextProps) {
  return (
    <span
      className={cn(
        'inline-block bg-[linear-gradient(110deg,rgba(255,255,255,0.25)_35%,rgba(255,255,255,0.95)_50%,rgba(255,255,255,0.25)_65%)] bg-[length:220%_100%] bg-clip-text text-transparent animate-[shiny_text_3.2s_ease-in-out_infinite]',
        className,
      )}
    >
      {children}
    </span>
  )
}
