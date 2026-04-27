'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search, Phone, MapPin, Clock3, Loader2 } from 'lucide-react'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { toast } from 'sonner'

const PAGE_SIZE = 20

type LeadSummary = {
  id: string
  name: string
  phone: string | null
  stage: string
  subStatus: string | null
  location: string | null
  created_at: string
  updated_at: string
  phaseTasks?: Array<{
    id: string
    status: string
    currentReviewRound: number
  }>
}

type LeadsResponse = {
  success: boolean
  data?: LeadSummary[]
  meta?: {
    total: number
    nextOffset: number | null
    hasMore: boolean
  }
}

function formatDistanceToNow(date: Date): string {
  const now = Date.now()
  const diffMs = now - date.getTime()
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'just now'

  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) return 'just now'
  if (diffMs < hour) {
    const minutes = Math.floor(diffMs / minute)
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  }
  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }

  const days = Math.floor(diffMs / day)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function formatLabel(value: string | null | undefined): string {
  if (!value) return 'N/A'
  if (value === 'DISCOVERY') return 'Consulting Phase'
  if (value === 'PROPOSAL_SENT') return 'Quotation Sent'
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function isReturnedForCorrection(lead: LeadSummary): boolean {
  const latestCadTask = lead.phaseTasks?.[0]
  if (!latestCadTask) return false
  const isCadReworkStatus = lead.subStatus === 'CAD_ASSIGNED' || lead.subStatus === 'CAD_WORKING'
  return isCadReworkStatus && latestCadTask.currentReviewRound > 0
}

export default function JrArchitectMyWorkPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const leadListQuery = useMemo(() => searchParams.toString(), [searchParams])
  const initialSearch = useMemo(() => searchParams.get('q')?.trim() || '', [searchParams])

  const [searchInput, setSearchInput] = useState(initialSearch)
  const [search, setSearch] = useState(initialSearch)
  const [leads, setLeads] = useState<LeadSummary[]>([])
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextOffset, setNextOffset] = useState<number | null>(0)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const getLeadHref = useCallback(
    (leadId: string) => {
      const query = leadListQuery
      return `/crm/jr-architecture/leads/${leadId}${query ? `?${query}` : ''}`
    },
    [leadListQuery],
  )

  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    const nextQuery = params.toString()
    const currentQuery = searchParams.toString()
    if (nextQuery === currentQuery) return
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
  }, [pathname, router, search, searchParams])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, 500)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const fetchLeads = useCallback(
    async (offset: number, replace: boolean) => {
      try {
        if (replace) setLoadingInitial(true)
        else setLoadingMore(true)

        const params = new URLSearchParams({
          limit: PAGE_SIZE.toString(),
          offset: offset.toString(),
          includeCadCorrectionFlag: '1',
        })
        if (search) params.set('search', search)

        const response = await fetch(`/api/lead?${params.toString()}`)
        const payload = (await response.json()) as LeadsResponse
        if (!response.ok || !payload.success) {
          throw new Error('Failed to load your assigned work')
        }

        const pageData = payload.data ?? []
        setLeads((prev) => (replace ? pageData : [...prev, ...pageData]))
        setTotal(payload.meta?.total ?? 0)
        setNextOffset(payload.meta?.nextOffset ?? null)
        setHasMore(Boolean(payload.meta?.hasMore))
      } catch (error) {
        console.error(error)
        toast.error(error instanceof Error ? error.message : 'Failed to load your work')
        if (replace) {
          setLeads([])
          setHasMore(false)
          setNextOffset(null)
        }
      } finally {
        setLoadingInitial(false)
        setLoadingMore(false)
      }
    },
    [search],
  )

  useEffect(() => {
    void fetchLeads(0, true)
  }, [fetchLeads])

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingInitial || loadingMore || nextOffset === null) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingMore) {
          void fetchLeads(nextOffset, false)
        }
      },
      { rootMargin: '200px 0px' },
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [fetchLeads, hasMore, loadingInitial, loadingMore, nextOffset])

  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="My Work"
        subtitle="All leads where you are assigned as JR Architect, across every stage of the journey."
      />

      <main className="mx-auto max-w-[1440px] px-4 py-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by lead name, phone, or email..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="pl-10"
            />
          </div>
          <Badge variant="outline" className="h-8 px-3">
            Total: {total}
          </Badge>
        </div>

        {loadingInitial ? (
          <div className="flex items-center justify-center rounded-lg border border-border bg-card py-14">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : leads.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No assigned leads found.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <Card
                key={lead.id}
                className={`overflow-hidden border-border/70 shadow-sm transition hover:border-primary/40 hover:shadow-md ${
                  isReturnedForCorrection(lead) ? 'bg-amber-50/60 border-amber-300/80' : ''
                }`}
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <Link href={getLeadHref(lead.id)} className="text-base font-semibold hover:text-primary hover:underline">
                        {lead.name}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{formatLabel(lead.stage)}</Badge>
                        {lead.subStatus ? <Badge variant="outline">{formatLabel(lead.subStatus)}</Badge> : null}
                        {isReturnedForCorrection(lead) ? (
                          <Badge className="border-amber-500/60 bg-amber-100 text-amber-900 hover:bg-amber-100">
                            Correction Required
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                    <p className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {lead.phone || 'No phone'}
                    </p>
                    <p className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {lead.location || 'No location'}
                    </p>
                    <p className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      Created {formatDistanceToNow(new Date(lead.created_at))}
                    </p>
                    <p className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      Updated {formatDistanceToNow(new Date(lead.updated_at))}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="mt-4 h-10" />
      </main>
    </div>
  )
}
