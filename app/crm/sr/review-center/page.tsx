'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { CrmPageHeader } from '@/components/crm/shared/page-header'
import {
  CalendarClock,
  Download,
  FileText,
  ImageIcon,
  MapPin,
  Phone,
  Search,
  UserRound,
} from 'lucide-react'
import { formatCadSubmissionFileType } from '@/lib/cad-work'
import { toast } from 'sonner'

type ReviewFile = {
  id: string
  url: string
  fileName: string
  fileType: string
  cadFileType: string
  sizeBytes: number | null
}

type ReviewSubmission = {
  id: string
  note: string | null
  submittedAt: string
  lead: {
    id: string
    name: string
    phone: string | null
    location: string | null
    stage: string
    subStatus: string | null
  }
  submittedBy: {
    id: string
    fullName: string
    email: string
  }
  files: ReviewFile[]
}

type ReviewApiResponse = {
  success: boolean
  data?: ReviewSubmission[]
  error?: string
}

function formatLabel(value: string | null | undefined): string {
  if (!value) return 'N/A'
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function isImageFile(file: ReviewFile): boolean {
  return file.fileType.toLowerCase().startsWith('image/')
}

function getDownloadUrl(url: string): string {
  return url.includes('?') ? `${url}&download=1` : `${url}?download=1`
}

function formatSubmittedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatFileSize(sizeBytes: number | null): string {
  if (!sizeBytes || sizeBytes <= 0) return 'Unknown size'
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

function FilePreviewCard({ file }: { file: ReviewFile }) {
  if (isImageFile(file)) {
    return (
      <div
        className="group relative h-20 w-28 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted transition hover:border-primary/50"
        title={`${file.fileName} • ${formatCadSubmissionFileType(file.cadFileType)}`}
      >
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 z-10"
          aria-label={`Open ${file.fileName}`}
        />
        <span
          className="absolute inset-0 block bg-cover bg-center"
          style={{ backgroundImage: `url("${file.url}")` }}
        />
        <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/35" />
        <span className="absolute bottom-1 left-1 right-1 truncate rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
          {formatCadSubmissionFileType(file.cadFileType)}
        </span>
        <a
          href={getDownloadUrl(file.url)}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-1 top-1 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 shadow transition group-hover:opacity-100"
          title="Download file"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      </div>
    )
  }

  return (
    <div
      className="group relative inline-flex h-20 min-w-[220px] shrink-0 flex-col justify-between rounded-md border border-border/70 bg-card px-3 py-2 transition hover:border-primary/50 hover:bg-accent/25"
      title={file.fileName}
    >
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 z-10"
        aria-label={`Open ${file.fileName}`}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="truncate text-xs font-medium text-foreground">{file.fileName}</p>
        </div>
        <a
          href={getDownloadUrl(file.url)}
          target="_blank"
          rel="noopener noreferrer"
          className="z-20 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground opacity-0 transition group-hover:opacity-100"
          title="Download file"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] text-muted-foreground">
          {formatCadSubmissionFileType(file.cadFileType)}
        </p>
        <p className="text-[11px] text-muted-foreground">{formatFileSize(file.sizeBytes)}</p>
      </div>
    </div>
  )
}

export default function SeniorCrmReviewCenterPage() {
  const [submissions, setSubmissions] = useState<ReviewSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const fetchSubmissions = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: '50',
        myLeadsOnly: '1',
      })
      if (search) params.set('search', search)

      const response = await fetch(`/api/cad-work/review-center?${params.toString()}`, {
        cache: 'no-store',
      })
      const payload = (await response.json()) as ReviewApiResponse
      if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
        throw new Error(payload.error ?? 'Failed to fetch CAD review submissions')
      }

      setSubmissions(payload.data)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Failed to fetch review submissions')
      setSubmissions([])
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    void fetchSubmissions()
  }, [fetchSubmissions])

  const totalFiles = useMemo(
    () => submissions.reduce((count, submission) => count + submission.files.length, 0),
    [submissions],
  )

  return (
    <div className="min-h-screen bg-background">
      <CrmPageHeader
        title="Review Center"
        subtitle="Review completed CAD submissions from Junior Architects with quick preview and download access."
      />

      <main className="mx-auto max-w-[1440px] px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by lead name, phone, or file..."
              className="pl-10"
            />
          </div>
          <Badge variant="outline" className="h-8 px-3">
            {submissions.length} submission{submissions.length === 1 ? '' : 's'} • {totalFiles} file
            {totalFiles === 1 ? '' : 's'}
          </Badge>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No CAD submissions found for review.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <Card
                key={submission.id}
                className="overflow-hidden border-border/70 shadow-sm transition hover:border-primary/40 hover:shadow-md"
              >
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <Link
                        href={`/crm/sr/leads/${submission.lead.id}`}
                        className="truncate text-base font-semibold text-foreground hover:text-primary hover:underline"
                      >
                        {submission.lead.name}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{formatLabel(submission.lead.stage)}</Badge>
                        {submission.lead.subStatus ? (
                          <Badge variant="outline">{formatLabel(submission.lead.subStatus)}</Badge>
                        ) : null}
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/crm/sr/leads/${submission.lead.id}`}>Open Lead</Link>
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {submission.lead.phone || 'No phone'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {submission.lead.location || 'No location'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="h-3.5 w-3.5" />
                      Submitted by {submission.submittedBy.fullName}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {formatSubmittedAt(submission.submittedAt)}
                    </span>
                  </div>

                  {submission.note ? (
                    <div className="rounded-md border border-border/70 bg-muted/35 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Submission Note
                      </p>
                      <p className="mt-1 text-sm text-foreground">{submission.note}</p>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Submitted Files
                    </p>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {submission.files.map((file) => (
                        <FilePreviewCard key={file.id} file={file} />
                      ))}
                      {submission.files.length === 0 ? (
                        <div className="inline-flex h-20 min-w-[230px] items-center gap-2 rounded-md border border-dashed border-border/70 px-3 text-xs text-muted-foreground">
                          <ImageIcon className="h-4 w-4" />
                          No files were submitted with this record.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
