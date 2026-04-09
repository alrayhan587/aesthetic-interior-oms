'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { formatDistanceToNow } from 'date-fns'

const PAGE_SIZE = 20

type LeadSummary = {
  id: string
  name: string
  stage: string
  location: string | null
  created_at: string
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

export default function JrArchLeadsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const initialSearch = useMemo(() => searchParams.get('q')?.trim() || '', [searchParams])
  const [leads, setLeads] = useState<LeadSummary[]>([])
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [search, setSearch] = useState(initialSearch)
  const [nextOffset, setNextOffset] = useState<number | null>(0)
  const [hasMore, setHasMore] = useState(true)

  const sentinelRef = useRef<HTMLDivElement | null>(null)

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

  const fetchLeads = useCallback(async (offset: number, replace: boolean) => {
    try {
      if (replace) setLoadingInitial(true)
      else setLoadingMore(true)

      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: offset.toString(),
      })
      if (search) params.set('search', search)

      const response = await fetch(`/api/lead?${params.toString()}`)
      const payload = (await response.json()) as LeadsResponse

      if (!response.ok || !payload.success) {
        throw new Error('Failed to load assigned leads')
      }

      const pageData = payload.data ?? []
      setLeads((prev) => (replace ? pageData : [...prev, ...pageData]))
      setNextOffset(payload.meta?.nextOffset ?? null)
      setHasMore(Boolean(payload.meta?.hasMore))
    } catch (error) {
      console.error(error)
      if (replace) {
        setLeads([])
        setHasMore(false)
        setNextOffset(null)
      }
    } finally {
      setLoadingInitial(false)
      setLoadingMore(false)
    }
  }, [search])

  useEffect(() => {
    fetchLeads(0, true)
  }, [fetchLeads])

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingInitial || loadingMore || nextOffset === null) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !loadingMore) fetchLeads(nextOffset, false) },
      { rootMargin: '200px 0px' }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [fetchLeads, hasMore, loadingInitial, loadingMore, nextOffset])

  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="Assigned CAD Projects"
        subtitle="Manage and track leads that require your architectural and design expertise."
      />
      <main className="mx-auto max-w-[1440px] px-4 py-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search assigned leads by name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loadingInitial ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No active CAD leads found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leads.map((lead) => (
              <Card key={lead.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg text-foreground truncate">{lead.name}</h3>
                    <span className="text-xs font-medium bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
                      {lead.stage.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {lead.location && (
                    <p className="text-sm text-muted-foreground mb-4 truncate">Location: {lead.location}</p>
                  )}
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-xs text-muted-foreground">
                      Created {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                    </p>
                    <Link href={`/crm/jr-architecture/leads/${lead.id}`}>
                      <Button size="sm">Workspace</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <div ref={sentinelRef} className="h-10 mt-4" />
      </main>
    </div>
  )
}
