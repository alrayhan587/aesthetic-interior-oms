'use client'

import { type ChangeEvent, useMemo, useState } from 'react'
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/sonner'

type ImportField =
  | 'ignore'
  | 'name'
  | 'phone'
  | 'email'
  | 'source'
  | 'location'
  | 'budget'
  | 'remarks'
  | 'assignedToEmail'
  | 'stage'

type PreviewRow = {
  rowNumber: number
  values: Record<string, string>
  issues: Array<{ type: 'error' | 'warning'; message: string }>
}

type PreviewResponse = {
  success: boolean
  data?: {
    headers: string[]
    mapping: Record<string, ImportField>
    fieldOptions: ImportField[]
    summary: { total: number; valid: number; invalid: number; withWarnings: number }
    previewRows: PreviewRow[]
  }
  error?: string
}

type ImportResponse = {
  success: boolean
  data?: {
    created: number
    skipped: number
    total: number
  }
  message?: string
  error?: string
}

type LeadImportModalProps = {
  onImported: () => void
}

function fieldLabel(field: ImportField): string {
  switch (field) {
    case 'ignore':
      return 'Ignore'
    case 'name':
      return 'Name'
    case 'phone':
      return 'Phone'
    case 'email':
      return 'Email'
    case 'source':
      return 'Source'
    case 'location':
      return 'Location'
    case 'budget':
      return 'Budget'
    case 'remarks':
      return 'Remarks'
    case 'assignedToEmail':
      return 'Assign To Email'
    case 'stage':
      return 'Stage'
    default:
      return field
  }
}

export function LeadImportModal({ onImported }: LeadImportModalProps) {
  const [open, setOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [mapping, setMapping] = useState<Record<string, ImportField>>({})
  const [fieldOptions, setFieldOptions] = useState<ImportField[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [summary, setSummary] = useState<{ total: number; valid: number; invalid: number; withWarnings: number } | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasPreview = useMemo(() => headers.length > 0 && summary !== null, [headers.length, summary])

  const resetState = () => {
    setCsvText('')
    setFileName('')
    setMapping({})
    setFieldOptions([])
    setHeaders([])
    setPreviewRows([])
    setSummary(null)
    setError(null)
    setLoadingPreview(false)
    setImporting(false)
  }

  const runPreview = async (text: string, currentMapping?: Record<string, ImportField>) => {
    if (!text.trim()) return
    setLoadingPreview(true)
    setError(null)

    try {
      const response = await fetch('/api/lead/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'preview',
          csvText: text,
          mapping: currentMapping ?? undefined,
        }),
      })

      const payload = (await response.json()) as PreviewResponse
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Preview failed')
      }

      setHeaders(payload.data.headers)
      setMapping(payload.data.mapping)
      setFieldOptions(payload.data.fieldOptions)
      setSummary(payload.data.summary)
      setPreviewRows(payload.data.previewRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a .csv file exported from Google Sheets.')
      return
    }

    const text = await file.text()
    setCsvText(text)
    setFileName(file.name)
    await runPreview(text)
  }

  const handleMappingChange = (header: string, value: ImportField) => {
    setMapping((prev) => ({
      ...prev,
      [header]: value,
    }))
  }

  const applyMappingAndRefresh = async () => {
    if (!csvText) return
    await runPreview(csvText, mapping)
  }

  const handleImport = async () => {
    if (!csvText || !hasPreview) return
    setImporting(true)
    setError(null)
    try {
      const response = await fetch('/api/lead/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'import',
          csvText,
          mapping,
        }),
      })

      const payload = (await response.json()) as ImportResponse
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Import failed')
      }

      toast.success(payload.message ?? `Imported ${payload.data.created} leads`)
      onImported()
      setOpen(false)
      resetState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetState()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Smart Lead Import</DialogTitle>
          <DialogDescription>
            Export Google Sheets as CSV, upload it here, review auto-matched fields, then create leads in one click.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Upload CSV</p>
            <Input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
            {fileName ? <p className="text-xs text-muted-foreground">File: {fileName}</p> : null}
          </div>

          {summary ? (
            <div className="grid gap-2 sm:grid-cols-4">
              <div className="rounded border p-3 text-sm">Total: {summary.total}</div>
              <div className="rounded border p-3 text-sm text-emerald-700">Valid: {summary.valid}</div>
              <div className="rounded border p-3 text-sm text-amber-700">Warnings: {summary.withWarnings}</div>
              <div className="rounded border p-3 text-sm text-red-700">Invalid: {summary.invalid}</div>
            </div>
          ) : null}

          {headers.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Field Mapping</p>
                <Button type="button" size="sm" variant="secondary" onClick={() => void applyMappingAndRefresh()} disabled={loadingPreview}>
                  {loadingPreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Re-analyze
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {headers.map((header) => (
                  <div key={header} className="rounded border p-2">
                    <p className="mb-1 truncate text-xs text-muted-foreground">{header}</p>
                    <Select
                      value={mapping[header] ?? 'ignore'}
                      onValueChange={(value) => handleMappingChange(header, value as ImportField)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {(fieldOptions.length > 0 ? fieldOptions : (['ignore'] as ImportField[])).map((field) => (
                          <SelectItem key={field} value={field}>
                            {fieldLabel(field)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {previewRows.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Preview (first {previewRows.length} rows)</p>
              <div className="space-y-2">
                {previewRows.slice(0, 10).map((row) => {
                  const hasError = row.issues.some((issue) => issue.type === 'error')
                  return (
                    <div key={row.rowNumber} className="rounded border p-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Row {row.rowNumber}</span>
                        {hasError ? <AlertCircle className="h-3.5 w-3.5 text-red-600" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                      </div>
                      {row.issues.length > 0 ? (
                        <ul className="mt-1 space-y-1 text-muted-foreground">
                          {row.issues.map((issue, idx) => (
                            <li key={idx} className={issue.type === 'error' ? 'text-red-700' : 'text-amber-700'}>
                              {issue.message}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-emerald-700">Looks good</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleImport()} disabled={!hasPreview || importing || loadingPreview}>
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Import Leads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
