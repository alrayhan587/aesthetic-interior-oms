'use client'

import { useEffect, useMemo, useState } from 'react'

type TextTypeProps = {
  texts: string[]
  className?: string
  typingSpeedMs?: number
  deletingSpeedMs?: number
  pauseMs?: number
}

export function TextType({
  texts,
  className = '',
  typingSpeedMs = 45,
  deletingSpeedMs = 24,
  pauseMs = 1100,
}: TextTypeProps) {
  const items = useMemo(
    () =>
      texts
        .map((item) => item.trim())
        .filter(Boolean),
    [texts],
  )

  const [textIndex, setTextIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (items.length === 0) return

    const current = items[textIndex % items.length]
    const isFull = charIndex === current.length

    let timeout: ReturnType<typeof setTimeout>

    if (!isDeleting && isFull) {
      timeout = setTimeout(() => setIsDeleting(true), pauseMs)
      return () => clearTimeout(timeout)
    }

    if (isDeleting && charIndex === 0) {
      timeout = setTimeout(() => {
        setIsDeleting(false)
        setTextIndex((prev) => (prev + 1) % items.length)
      }, 220)
      return () => clearTimeout(timeout)
    }

    timeout = setTimeout(
      () => setCharIndex((prev) => (isDeleting ? prev - 1 : prev + 1)),
      isDeleting ? deletingSpeedMs : typingSpeedMs,
    )

    return () => clearTimeout(timeout)
  }, [charIndex, deletingSpeedMs, isDeleting, items, pauseMs, textIndex, typingSpeedMs])

  if (items.length === 0) return null

  const current = items[textIndex % items.length]
  const visible = current.slice(0, charIndex)

  return (
    <span className={className}>
      {visible}
      <span className="ml-1 inline-block animate-pulse">|</span>
    </span>
  )
}
