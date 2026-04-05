'use client'

import { useCallback, useMemo, useState } from 'react'
import { Loader2, MessageCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type FacebookMessage = {
  id: string
  message: string
  createdAt: string
  from: {
    id: string | null
    name: string | null
  }
  senderType: 'PAGE' | 'CLIENT' | 'UNKNOWN'
}

type ApiResponse = {
  success: boolean
  data?: {
    conversationId: string
    messages: FacebookMessage[]
  }
  error?: string
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || 'Unknown time'
  return date.toLocaleString()
}

export function FacebookMessagesDialog({ leadId, source }: { leadId: string; source: string | null }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<FacebookMessage[]>([])

  const isFacebookLead = (source ?? '').trim().toLowerCase() === 'facebook'

  const loadMessages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/lead/${leadId}/facebook-messages?limit=100`, { cache: 'no-store' })
      const payload = (await response.json()) as ApiResponse
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Failed to load Facebook messages')
      }
      setMessages(payload.data.messages)
    } catch (err) {
      setMessages([])
      setError(err instanceof Error ? err.message : 'Failed to load Facebook messages')
    } finally {
      setLoading(false)
    }
  }, [leadId])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (nextOpen) {
        void loadMessages()
      }
    },
    [loadMessages],
  )

  const title = useMemo(() => (isFacebookLead ? 'Facebook Messages' : 'Messages'), [isFacebookLead])

  if (!isFacebookLead) return null

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => handleOpenChange(true)}>
        <MessageCircle className="h-4 w-4" />
        View FB Messages
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[85vh] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Read-only conversation between your page and this client.</DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading messages...
              </div>
            ) : error ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages found.</p>
            ) : (
              messages.map((message) => {
                const isMe = message.senderType === 'PAGE'
                return (
                  <div
                    key={message.id}
                    className={`rounded-lg border p-3 ${isMe ? 'border-blue-200 bg-blue-50' : 'border-border bg-muted/30'}`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{isMe ? 'You' : message.from.name ?? 'Client'}</span>
                      <span>{formatTimestamp(message.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-foreground">
                      {message.message || '[No text content]'}
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
