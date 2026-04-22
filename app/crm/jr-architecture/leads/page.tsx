'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Phone,
  ImageIcon,
  FileText,
  Loader2,
  Play,
  MapPin,
  Clock3,
  Upload,
  Plus,
  X,
} from 'lucide-react'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import { toast } from 'sonner'
import {
  CAD_SUBMISSION_FILE_TYPE_OPTIONS,
  type CadSubmissionFileTypeValue,
  formatCadSubmissionFileType,
} from '@/lib/cad-work'

const PAGE_SIZE = 20

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

type LeadSummary = {
  id: string
  name: string
  phone: string | null
  stage: string
  subStatus: string | null
  location: string | null
  created_at: string
  attachments?: Array<{
    id: string
    url: string
    fileName: string
    fileType: string
    category: string
    sizeBytes: number | null
    createdAt: string
  }>
}

type LeadAttachmentPreview = NonNullable<LeadSummary['attachments']>[number]

type LeadsResponse = {
  success: boolean
  data?: LeadSummary[]
  meta?: {
    total: number
    nextOffset: number | null
    hasMore: boolean
  }
}

type CadSubmissionRow = {
  id: string
  cadFileType: CadSubmissionFileTypeValue
  file: File | null
}

function createCadSubmissionRow(initialType: CadSubmissionFileTypeValue = 'FLOOR_PLAN'): CadSubmissionRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    cadFileType: initialType,
    file: null,
  }
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

function isImageAttachment(attachment: LeadAttachmentPreview): boolean {
  return attachment.fileType?.toLowerCase().startsWith('image/')
}

function canShowQuickPreview(lead: LeadSummary): boolean {
  if (lead.stage !== 'CAD_PHASE') return false
  return lead.subStatus === 'CAD_WORKING' || lead.subStatus === 'CAD_COMPLETED' || lead.subStatus === 'CAD_APPROVED'
}

export default function JrArchLeadsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const leadListQuery = useMemo(() => searchParams.toString(), [searchParams])

  const initialSearch = useMemo(() => searchParams.get('q')?.trim() || '', [searchParams])
  const [leads, setLeads] = useState<LeadSummary[]>([])
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [search, setSearch] = useState(initialSearch)
  const [nextOffset, setNextOffset] = useState<number | null>(0)
  const [hasMore, setHasMore] = useState(true)
  const [startWorkOpen, setStartWorkOpen] = useState(false)
  const [startWorkLead, setStartWorkLead] = useState<LeadSummary | null>(null)
  const [startingWork, setStartingWork] = useState(false)
  const [submitWorkOpen, setSubmitWorkOpen] = useState(false)
  const [submitWorkLead, setSubmitWorkLead] = useState<LeadSummary | null>(null)
  const [submittingWork, setSubmittingWork] = useState(false)
  const [submissionNote, setSubmissionNote] = useState('')
  const [submissionRows, setSubmissionRows] = useState<CadSubmissionRow[]>([createCadSubmissionRow()])
  const getLeadHref = useCallback(
    (leadId: string) => {
      const query = leadListQuery
      return `/crm/jr-architecture/leads/${leadId}${query ? `?${query}` : ''}`
    },
    [leadListQuery],
  )

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
        includeAttachmentPreview: '1',
        stage: 'CAD_PHASE',
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
      toast.error(error instanceof Error ? error.message : 'Failed to load assigned leads')
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

  const openStartWorkDialog = useCallback((lead: LeadSummary) => {
    setStartWorkLead(lead)
    setStartWorkOpen(true)
  }, [])

  const handleStartWork = useCallback(async () => {
    if (!startWorkLead) return
    setStartingWork(true)
    try {
      const response = await fetch(`/api/lead/${startWorkLead.id}/cad-work/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Started from JR Architect assigned lead list',
        }),
      })
      const payload = (await response.json()) as { success?: boolean; message?: string; error?: string }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Failed to start work')
      }

      toast.success(payload.message ?? 'Work started')
      setStartWorkOpen(false)
      setStartWorkLead(null)
      await fetchLeads(0, true)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Failed to start work')
    } finally {
      setStartingWork(false)
    }
  }, [fetchLeads, startWorkLead])

  const openSubmitWorkDialog = useCallback((lead: LeadSummary) => {
    setSubmitWorkLead(lead)
    setSubmissionRows([createCadSubmissionRow()])
    setSubmissionNote('')
    setSubmitWorkOpen(true)
  }, [])

  const updateSubmissionType = useCallback((rowId: string, value: CadSubmissionFileTypeValue) => {
    setSubmissionRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, cadFileType: value } : row)),
    )
  }, [])

  const updateSubmissionFile = useCallback((rowId: string, file: File | null) => {
    setSubmissionRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, file } : row)),
    )
  }, [])

  const addSubmissionRow = useCallback(() => {
    setSubmissionRows((prev) => [...prev, createCadSubmissionRow('OTHERS')])
  }, [])

  const removeSubmissionRow = useCallback((rowId: string) => {
    setSubmissionRows((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((row) => row.id !== rowId)
    })
  }, [])

  const handleSubmitWork = useCallback(async () => {
    if (!submitWorkLead) return

    const rowsWithFiles = submissionRows.filter((row) => row.file)
    if (rowsWithFiles.length === 0) {
      toast.error('Please upload at least one file before submitting work')
      return
    }
    if (rowsWithFiles.length !== submissionRows.length) {
      toast.error('Please select a file for every row, or remove empty rows')
      return
    }

    const formData = new FormData()
    if (submissionNote.trim()) {
      formData.append('note', submissionNote.trim())
    }

    rowsWithFiles.forEach((row) => {
      if (!row.file) return
      formData.append('files', row.file)
      formData.append('cadFileTypes', row.cadFileType)
    })

    try {
      setSubmittingWork(true)
      const response = await fetch(`/api/lead/${submitWorkLead.id}/cad-work/submit`, {
        method: 'POST',
        body: formData,
      })
      const payload = (await response.json()) as { success?: boolean; message?: string; error?: string }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Failed to submit CAD work')
      }

      toast.success(payload.message ?? 'CAD work submitted successfully')
      setSubmitWorkOpen(false)
      setSubmitWorkLead(null)
      setSubmissionRows([createCadSubmissionRow()])
      setSubmissionNote('')
      await fetchLeads(0, true)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Failed to submit CAD work')
    } finally {
      setSubmittingWork(false)
    }
  }, [fetchLeads, submissionNote, submissionRows, submitWorkLead])

  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="Assigned Work"
        subtitle="CAD phase leads assigned to you. Start, continue, and submit architectural work."
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
          <div className="space-y-4">
            {leads.map((lead) => (
              <Card
                key={lead.id}
                className="overflow-hidden border-border/70 shadow-sm transition hover:border-primary/40 hover:shadow-md"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={getLeadHref(lead.id)}
                          className="truncate text-base font-semibold text-foreground hover:text-primary hover:underline"
                        >
                          {lead.name}
                        </Link>
                        <Badge variant="secondary">{formatLabel(lead.stage)}</Badge>
                        {lead.subStatus ? <Badge variant="outline">{formatLabel(lead.subStatus)}</Badge> : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {lead.phone || 'No phone number'}
                        </span>
                        {lead.location ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {lead.location}
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          Created {formatDistanceToNow(new Date(lead.created_at))}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Quick Preview
                        </p>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {canShowQuickPreview(lead)
                            ? (lead.attachments ?? []).slice(0, 6).map((attachment) => {
                                const isImage = isImageAttachment(attachment)
                                if (isImage) {
                                  return (
                                    <a
                                      key={attachment.id}
                                      href={attachment.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted transition hover:border-primary/40"
                                      title={attachment.fileName}
                                    >
                                      <span
                                        className="absolute inset-0 block bg-cover bg-center"
                                        style={{ backgroundImage: `url("${attachment.url}")` }}
                                      />
                                    </a>
                                  )
                                }

                                return (
                                  <a
                                    key={attachment.id}
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-14 min-w-[170px] shrink-0 items-center gap-2 rounded-md border border-border/60 bg-card px-3 text-xs text-foreground transition hover:border-primary/40 hover:bg-secondary/30"
                                    title={attachment.fileName}
                                  >
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="truncate">{attachment.fileName}</span>
                                  </a>
                                )
                              })
                            : null}

                          {canShowQuickPreview(lead) && (lead.attachments?.length ?? 0) === 0 ? (
                            <div className="inline-flex h-14 min-w-[190px] items-center gap-2 rounded-md border border-dashed border-border/70 px-3 text-xs text-muted-foreground">
                              <ImageIcon className="h-3.5 w-3.5" />
                              No media or files uploaded yet
                            </div>
                          ) : null}

                          {!canShowQuickPreview(lead) ? (
                            <div className="inline-flex h-14 min-w-[250px] items-center gap-2 rounded-md border border-dashed border-border/70 bg-muted/35 px-3 text-xs text-muted-foreground">
                              <Play className="h-3.5 w-3.5 text-primary" />
                              Click Start Work to unlock preview
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-col lg:items-end">
                      {lead.stage === 'CAD_PHASE' && lead.subStatus === 'CAD_WORKING' ? (
                        <Button
                          variant="default"
                          size="sm"
                          disabled={submittingWork && submitWorkLead?.id === lead.id}
                          onClick={() => openSubmitWorkDialog(lead)}
                        >
                          {submittingWork && submitWorkLead?.id === lead.id ? (
                            <>
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <Upload className="mr-1 h-4 w-4" />
                              Submit Work
                            </>
                          )}
                        </Button>
                      ) : null}
                      {lead.stage === 'CAD_PHASE' &&
                      (lead.subStatus === 'CAD_COMPLETED' || lead.subStatus === 'CAD_APPROVED') ? (
                        <Button variant="secondary" size="sm" disabled>
                          <Upload className="mr-1 h-4 w-4" />
                          Work Submitted
                        </Button>
                      ) : null}
                      <Button asChild size="sm">
                        <Link href={getLeadHref(lead.id)}>Workspace</Link>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={
                          (startingWork && startWorkLead?.id === lead.id) ||
                          (lead.stage === 'CAD_PHASE' &&
                            (lead.subStatus === 'CAD_WORKING' ||
                              lead.subStatus === 'CAD_COMPLETED' ||
                              lead.subStatus === 'CAD_APPROVED'))
                        }
                        onClick={() => openStartWorkDialog(lead)}
                      >
                        {startingWork && startWorkLead?.id === lead.id ? (
                          <>
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            Starting...
                          </>
                        ) : lead.stage === 'CAD_PHASE' &&
                          (lead.subStatus === 'CAD_WORKING' ||
                            lead.subStatus === 'CAD_COMPLETED' ||
                            lead.subStatus === 'CAD_APPROVED') ? (
                          'Work Started'
                        ) : (
                          <>
                            <Play className="mr-1 h-4 w-4" />
                            Start Work
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <div ref={sentinelRef} className="h-10 mt-4" />
      </main>

      <Dialog
        open={startWorkOpen}
        onOpenChange={(open) => {
          if (startingWork) return
          setStartWorkOpen(open)
          if (!open) setStartWorkLead(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start CAD Work?</DialogTitle>
            <DialogDescription>
              {startWorkLead
                ? `Confirm starting work for ${startWorkLead.name}. This will update the lead to CAD Phase -> CAD Working.`
                : 'This action will update the lead to CAD Working.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (startingWork) return
                setStartWorkOpen(false)
                setStartWorkLead(null)
              }}
              disabled={startingWork}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleStartWork} disabled={startingWork || !startWorkLead}>
              {startingWork ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Yes, Start Work'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={submitWorkOpen}
        onOpenChange={(open) => {
          if (submittingWork) return
          setSubmitWorkOpen(open)
          if (!open) {
            setSubmitWorkLead(null)
            setSubmissionRows([createCadSubmissionRow()])
            setSubmissionNote('')
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Submit CAD Work</DialogTitle>
            <DialogDescription>
              {submitWorkLead
                ? `Upload completed files for ${submitWorkLead.name}. This will move the lead to CAD Completed and send it to Senior CRM Review Center.`
                : 'Upload completed CAD files with file types.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2 rounded-md border border-border/70 bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Files & Types
              </p>
              {submissionRows.map((row, index) => (
                <div
                  key={row.id}
                  className="grid gap-2 rounded-md border border-border/60 bg-background p-3 md:grid-cols-[1fr_1.4fr_auto]"
                >
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground">File Type</p>
                    <Select
                      value={row.cadFileType}
                      onValueChange={(value) =>
                        updateSubmissionType(row.id, value as CadSubmissionFileTypeValue)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select file type" />
                      </SelectTrigger>
                      <SelectContent>
                        {CAD_SUBMISSION_FILE_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground">File</p>
                    <Input
                      type="file"
                      accept=".pdf,.ppt,.pptx,.dwg,.dxf"
                      onChange={(event) => updateSubmissionFile(row.id, event.target.files?.[0] ?? null)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {row.file
                        ? `${row.file.name} • ${formatCadSubmissionFileType(row.cadFileType)}`
                        : 'Upload PDF, PPT, PPTX, DWG, or DXF file'}
                    </p>
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSubmissionRow(row.id)}
                      disabled={submissionRows.length === 1}
                      title="Remove file row"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <p className="md:col-span-3 text-[11px] text-muted-foreground">
                    Row {index + 1}: {formatCadSubmissionFileType(row.cadFileType)}
                  </p>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={addSubmissionRow}
                disabled={submissionRows.length >= 12}
              >
                <Plus className="h-4 w-4" />
                Add Another File
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Optional Note
              </p>
              <Textarea
                value={submissionNote}
                onChange={(event) => setSubmissionNote(event.target.value)}
                rows={3}
                placeholder="Add short summary or handoff note for Senior CRM..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submittingWork}
              onClick={() => {
                if (submittingWork) return
                setSubmitWorkOpen(false)
                setSubmitWorkLead(null)
                setSubmissionRows([createCadSubmissionRow()])
                setSubmissionNote('')
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmitWork} disabled={submittingWork || !submitWorkLead}>
              {submittingWork ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit CAD Work'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
