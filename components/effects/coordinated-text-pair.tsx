'use client'

import { useEffect, useMemo, useState } from 'react'

type CoordinatedTextPairItem = {
  title: string
  description: string
}

type CoordinatedTextPairProps = {
  items: CoordinatedTextPairItem[]
  className?: string
  titleClassName?: string
  descriptionClassName?: string
  typingSpeedMs?: number
  deletingSpeedMs?: number
  pauseMs?: number
}

export function CoordinatedTextPair({
  items,
  className = '',
  titleClassName = '',
  descriptionClassName = '',
  typingSpeedMs = 30,
  deletingSpeedMs = 20,
  pauseMs = 1200,
}: CoordinatedTextPairProps) {
  const normalized = useMemo(
    () =>
      items
        .map((item) => ({
          title: item.title.trim(),
          description: item.description.trim(),
        }))
        .filter((item) => item.title.length > 0 && item.description.length > 0),
    [items],
  )

  const [itemIndex, setItemIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (normalized.length === 0) return

    const current = normalized[itemIndex % normalized.length]
    const maxLen = Math.max(current.title.length, current.description.length)

    let timeout: ReturnType<typeof setTimeout>

    if (!isDeleting && progress >= maxLen) {
      timeout = setTimeout(() => setIsDeleting(true), pauseMs)
      return () => clearTimeout(timeout)
    }

    if (isDeleting && progress <= 0) {
      timeout = setTimeout(() => {
        setIsDeleting(false)
        setItemIndex((prev) => (prev + 1) % normalized.length)
      }, 220)
      return () => clearTimeout(timeout)
    }

    timeout = setTimeout(
      () => setProgress((prev) => (isDeleting ? prev - 1 : prev + 1)),
      isDeleting ? deletingSpeedMs : typingSpeedMs,
    )

    return () => clearTimeout(timeout)
  }, [deletingSpeedMs, isDeleting, itemIndex, normalized, pauseMs, progress, typingSpeedMs])

  if (normalized.length === 0) return null

  const current = normalized[itemIndex % normalized.length]
  const visibleTitle = current.title.slice(0, Math.max(0, progress))
  const visibleDescription = current.description.slice(0, Math.max(0, progress))

  return (
    <div className={className}>
      <p className={titleClassName}>
        {visibleTitle}
        <span className="ml-1 inline-block animate-pulse">|</span>
      </p>
      <p className={descriptionClassName}>
        {visibleDescription}
      </p>
    </div>
  )
}
