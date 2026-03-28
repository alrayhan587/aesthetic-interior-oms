'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, List, LayoutGrid, CircleDot, PhoneCall, Handshake, Sprout, CalendarCheck, CheckCircle2, Archive } from 'lucide-react'
import LeadCreateModal from '@/components/crm/junior/LeadCreateModal'
import { CrmPageHeader } from '@/components/crm/shared/page-header'

const PAGE_SIZE = 20
const stages = ['NEW', 'NUMBER_COLLECTED', 'CONTACT_ATTEMPTED', 'NURTURING', 'VISIT_SCHEDULED', 'VISIT_COMPLETED', 'CLOSED']

type ViewMode = 'list' | 'card'

const stageColors: Record<string, string> = {
  NEW: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
  NUMBER_COLLECTED: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200',
  CONTACT_ATTEMPTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  NURTURING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  VISIT_SCHEDULED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  VISIT_COMPLETED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  CLOSED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
}

const stageStatConfig: Record<string, { icon: typeof CircleDot; tint: string }> = {
  NEW: { icon: CircleDot, tint: 'text-slate-600 bg-slate-100 dark:bg-slate-900/40 dark:text-slate-200' },
  NUMBER_COLLECTED: { icon: PhoneCall, tint: 'text-cyan-700 bg-cyan-100 dark:bg-cyan-900/40 dark:text-cyan-200' },
  CONTACT_ATTEMPTED: { icon: Handshake, tint: 'text-blue-700 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-200' },
  NURTURING: { icon: Sprout, tint: 'text-yellow-700 bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-200' },
  VISIT_SCHEDULED: { icon: CalendarCheck, tint: 'text-purple-700 bg-purple-100 dark:bg-purple-900/40 dark:text-purple-200' },
  VISIT_COMPLETED: { icon: CheckCircle2, tint: 'text-indigo-700 bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-200' },
  CLOSED: { icon: Archive, tint: 'text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-200' },
}

type LeadSummary = {
  id: string
  name: string
  phone: string | null
  email: string | null
  stage: string
  location: string | null
  created_at: string
  assignments?: Array<{
    id: string
    department: string
    user: { id: string; fullName: string; email: string }
  }>
}

type LeadsResponse = {
  success: boolean
  data?: LeadSummary[]
  meta?: {
    total: number
    offset: number
    nextOffset: number | null
    hasMore: boolean
    stageCounts?: Record<string, number>
  }
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadSummary[]>([])
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('ALL')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({})
  const [totalCount, setTotalCount] = useState(0)
  const [nextOffset, setNextOffset] = useState<number | null>(0)
  const [hasMore, setHasMore] = useState(true)

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1024px)')
    setViewMode(mediaQuery.matches ? 'card' : 'list')
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  const fetchLeads = useCallback(async (offset: number, replace: boolean) => {
    try {
      if (replace) {
        setLoadingInitial(true)
      } else {
        setLoadingMore(true)
      }

      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: offset.toString(),
      })

      if (search) {
        params.set('search', search)
      }

      if (stageFilter !== 'ALL') {
        params.set('stage', stageFilter)
      }

      const res = await fetch(`/api/lead?${params.toString()}`)
      const payload = (await res.json()) as LeadsResponse

      if (!res.ok || !payload.success) {
        throw new Error('Failed to load leads')
      }

      const pageData = payload.data ?? []
      const meta = payload.meta

      setLeads((prev) => (replace ? pageData : [...prev, ...pageData]))
      setNextOffset(meta?.nextOffset ?? null)
      setHasMore(Boolean(meta?.hasMore))
      setTotalCount(meta?.total ?? 0)
      setStageCounts(meta?.stageCounts ?? {})
    } catch (error) {
      console.error('Error fetching leads:', error)
      if (replace) {
        setLeads([])
        setHasMore(false)
        setNextOffset(null)
        setTotalCount(0)
      }
    } finally {
      setLoadingInitial(false)
      setLoadingMore(false)
    }
  }, [search, stageFilter])

  useEffect(() => {
    fetchLeads(0, true)
  }, [fetchLeads])

  useEffect(() => {
    const sentinel = sentinelRef.current

    if (!sentinel || !hasMore || loadingInitial || loadingMore || nextOffset === null) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && !loadingMore) {
          fetchLeads(nextOffset, false)
        }
      },
      { rootMargin: '400px 0px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [fetchLeads, hasMore, loadingInitial, loadingMore, nextOffset])

  const refreshLeads = useCallback(() => {
    fetchLeads(0, true)
  }, [fetchLeads])

  const displayedCount = useMemo(() => leads.length, [leads])

  const renderLoadingSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="rounded-lg border border-border p-4 animate-pulse">
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="mt-2 h-3 w-28 rounded bg-muted" />
          <div className="mt-3 h-3 w-52 rounded bg-muted" />
        </div>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="Leads"
        subtitle="Manage and track all your leads"
      />
      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <div className="space-y-6">
          <div className="flex items-center justify-end">
            <LeadCreateModal onCreated={refreshLeads} />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {stages.map((stage) => {
              const config = stageStatConfig[stage]
              const Icon = config.icon
              return (
                <Card key={stage} className="border-border bg-card">
                  <CardContent className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                    <div className={`inline-flex size-10 items-center justify-center rounded-lg ${config.tint}`}>
                      <Icon className="size-5" />
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">{stage.replace(/_/g, ' ')}</p>
                    <p className="text-3xl font-bold leading-tight text-foreground">{stageCounts[stage] ?? 0}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-full md:w-56">
                <SelectValue placeholder="Filter by stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Stages</SelectItem>
                {stages.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="inline-flex rounded-md border border-border p-1">
              <Button
                type="button"
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="gap-2"
              >
                <List className="h-4 w-4" /> List
              </Button>
              <Button
                type="button"
                variant={viewMode === 'card' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('card')}
                className="gap-2"
              >
                <LayoutGrid className="h-4 w-4" /> Cards
              </Button>
            </div>
          </div>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">Leads ({displayedCount}/{totalCount})</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingInitial ? (
                renderLoadingSkeleton()
              ) : leads.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No leads found.</div>
              ) : viewMode === 'card' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {leads.map((lead) => (
                    <Card key={lead.id} className="border-border">
                      <CardContent className="space-y-3 p-4">
                        <div>
                          <p className="font-semibold text-foreground">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">{lead.email || 'No email'}</p>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p>Phone: {lead.phone || '—'}</p>
                          <p>JR CRM: {lead.assignments?.[0]?.user?.fullName || 'Unassigned'}</p>
                          <p>Location: {lead.location || '—'}</p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${stageColors[lead.stage]}`}>
                            {lead.stage}
                          </span>
                          <Link href={`/crm/jr/leads/${lead.id}`}>
                            <Button variant="outline" size="sm">View</Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Lead Name</th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Phone</th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">JR CRM</th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Location</th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Stage</th>
                        <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((lead) => (
                        <tr key={lead.id} className="border-b hover:bg-muted/50">
                          <td className="py-4 px-4">
                            <div className="font-medium text-foreground">{lead.name}</div>
                            <div className="text-xs text-muted-foreground">{lead.email || 'No email'}</div>
                          </td>
                          <td className="py-4 px-4">{lead.phone || '—'}</td>
                          <td className="py-4 px-4">{lead.assignments?.[0]?.user?.fullName || 'Unassigned'}</td>
                          <td className="py-4 px-4">{lead.location || '—'}</td>
                          <td className="py-4 px-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${stageColors[lead.stage]}`}>
                              {lead.stage}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <Link href={`/crm/jr/leads/${lead.id}`}>
                              <Button variant="outline" size="sm">View</Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {loadingMore ? <p className="mt-4 text-center text-sm text-muted-foreground">Loading more leads...</p> : null}
              <div ref={sentinelRef} className="h-1" />
              {!hasMore && leads.length > 0 ? (
                <p className="mt-4 text-center text-xs text-muted-foreground">You have reached the end of the list.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
