'use client'

import { useEffect, useMemo, useState } from 'react'

type TrueFocusProps = {
  text: string
  className?: string
  intervalMs?: number
}

export function TrueFocus({ text, className = '', intervalMs = 1200 }: TrueFocusProps) {
  const words = useMemo(
    () =>
      text
        .split(/\s+/)
        .map((word) => word.trim())
        .filter(Boolean),
    [text],
  )

  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (words.length <= 1) return
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % words.length)
    }, Math.max(600, intervalMs))

    return () => clearInterval(timer)
  }, [words.length, intervalMs])

  if (words.length === 0) return null

  return (
    <span className={`inline-flex flex-wrap justify-center gap-x-3 gap-y-1 ${className}`}>
      {words.map((word, index) => {
        const isActive = index === activeIndex
        return (
          <span
            key={`${word}-${index}`}
            className="transition-all duration-500"
            style={{
              filter: isActive ? 'blur(0px)' : 'blur(1.8px)',
              opacity: isActive ? 1 : 0.5,
              transform: isActive ? 'scale(1)' : 'scale(0.98)',
            }}
          >
            {word}
          </span>
        )
      })}
    </span>
  )
}
