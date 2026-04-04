'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bell, BellRing, Volume2, VolumeX } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/sonner'

type NotificationItem = {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  scheduledFor: string | null
  lead: { id: string; name: string } | null
  subjectUser?: { id: string; fullName: string; email: string } | null
}

type NotificationsResponse = {
  success: boolean
  data?: {
    items: NotificationItem[]
    unreadCount: number
  }
  error?: string
}

const NOTIFICATION_SOUND_SRC = '/sounds/mixkit-correct-answer-tone-2870.wav'

function formatWhen(value: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

function playAlertBeep() {
  if (typeof window === 'undefined') return
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return
  const ctx = new AudioCtx()
  const master = ctx.createGain()
  master.gain.value = 0.16
  master.connect(ctx.destination)

  const playTone = (startAt: number, frequency: number, duration = 0.11) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(frequency, startAt)
    osc.frequency.exponentialRampToValueAtTime(frequency * 1.04, startAt + duration)

    gain.gain.setValueAtTime(0.0001, startAt)
    gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

    osc.connect(gain)
    gain.connect(master)
    osc.start(startAt)
    osc.stop(startAt + duration + 0.02)
  }

  const t0 = ctx.currentTime
  playTone(t0, 988, 0.1) // B5
  playTone(t0 + 0.115, 1318.5, 0.12) // E6
}

export function NotificationBell() {
  const router = useRouter()
  const pathname = usePathname() || ''
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const knownIdsRef = useRef<Set<string>>(new Set())
  const soundRef = useRef<HTMLAudioElement | null>(null)
  const visibleUnreadCountRef = useRef(0)
  const wasHiddenRef = useRef(false)
  const unreadCountRef = useRef(0)
  const originalTitleRef = useRef<string | null>(null)

  const playNotificationSound = useCallback(() => {
    if (typeof window === 'undefined') return
    if (!soundRef.current) {
      const audio = new Audio(NOTIFICATION_SOUND_SRC)
      audio.preload = 'auto'
      soundRef.current = audio
    }

    const audio = soundRef.current
    audio.currentTime = 0
    void audio.play().catch(() => {
      playAlertBeep()
    })
  }, [])

  const loadNotifications = useCallback(async (showLoading = false, fromReturn = false) => {
    if (showLoading) setLoading(true)
    try {
      const response = await fetch('/api/notifications?limit=20', { cache: 'no-store' })
      const payload = (await response.json()) as NotificationsResponse
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'Failed to load notifications')
      }

      const prevKnown = knownIdsRef.current
      const nextKnown = new Set(prevKnown)
      let hasNew = false
      for (const item of payload.data.items) {
        if (!prevKnown.has(item.id)) {
          hasNew = true
        }
        nextKnown.add(item.id)
      }
      knownIdsRef.current = nextKnown

      setItems(payload.data.items)
      setUnreadCount(payload.data.unreadCount)

      const shouldRingFromReturn =
        fromReturn &&
        payload.data.unreadCount > visibleUnreadCountRef.current
      const shouldRingForNew = hasNew && payload.data.unreadCount > 0

      if ((shouldRingFromReturn || shouldRingForNew) && payload.data.unreadCount > 0) {
        if (soundEnabled) {
          playNotificationSound()
        }
        const firstUnread = payload.data.items.find((item) => !item.isRead)
        if (firstUnread) {
          toast.info(firstUnread.title, {
            description: firstUnread.message,
          })
        }
      }

      visibleUnreadCountRef.current = payload.data.unreadCount
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [soundEnabled, playNotificationSound])

  useEffect(() => {
    unreadCountRef.current = unreadCount
  }, [unreadCount])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!originalTitleRef.current) {
      originalTitleRef.current = document.title
    }
    const baseTitle = originalTitleRef.current
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${baseTitle}`
    } else {
      document.title = baseTitle
    }
    return () => {
      if (originalTitleRef.current) {
        document.title = originalTitleRef.current
      }
    }
  }, [unreadCount])

  useEffect(() => {
    const saved = window.localStorage.getItem('crm_notification_sound')
    setSoundEnabled(saved !== 'off')
    loadNotifications(true)

    const timer = window.setInterval(() => {
      loadNotifications(false)
    }, 30000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        wasHiddenRef.current = true
        visibleUnreadCountRef.current = unreadCountRef.current
        return
      }
      if (document.visibilityState === 'visible' && wasHiddenRef.current) {
        wasHiddenRef.current = false
        void loadNotifications(false, true)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadNotifications])

  const unreadItems = useMemo(() => items.filter((item) => !item.isRead), [items])

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to mark as read')
      }
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const markAllRead = async () => {
    try {
      const response = await fetch('/api/notifications', { method: 'PATCH' })
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to mark all as read')
      }
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }

  const toggleSound = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    window.localStorage.setItem('crm_notification_sound', next ? 'on' : 'off')
    if (next) {
      playNotificationSound()
      toast.success('Notification sound enabled')
    } else {
      toast.message('Notification sound muted')
    }
  }

  const buildLeadPath = (leadId: string) => {
    if (pathname.startsWith('/visit-team')) {
      return `/visit-team/leads/${leadId}`
    }
    if (pathname.startsWith('/crm/admin')) {
      return `/crm/admin/leads/${leadId}`
    }
    return `/crm/jr/leads/${leadId}`
  }

  const handleNotificationClick = async (item: NotificationItem) => {
    await markAsRead(item.id)
    if (item.lead?.id) {
      router.push(buildLeadPath(item.lead.id))
      return
    }
    if (item.type === 'SIGNUP_PENDING_APPROVAL' && pathname.startsWith('/crm/admin')) {
      router.push('/crm/admin/settings')
      return
    }
    if (item.type === 'FACEBOOK_LEAD_SYNC_SUMMARY' && pathname.startsWith('/crm/admin')) {
      router.push('/crm/admin/leads')
      return
    }
    if (item.type === 'LEAD_ASSIGNED_TO_YOU' && pathname.startsWith('/crm/jr')) {
      router.push('/crm/jr/leads')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {unreadCount > 0 ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
          {unreadCount > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-4 px-1 text-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={toggleSound}>
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="text-xs font-medium"
        >
          Mark all as read
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="px-2 py-2 text-xs text-muted-foreground">Loading...</div>
        ) : unreadItems.length === 0 ? (
          <div className="px-2 py-2 text-xs text-muted-foreground">No unread notifications</div>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-1">
            {unreadItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNotificationClick(item)}
                className="w-full rounded-sm border border-border px-2 py-2 text-left hover:bg-accent"
              >
                <p className="text-xs font-semibold text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.message}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {formatWhen(item.scheduledFor) ?? formatWhen(item.createdAt)}
                </p>
              </button>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
