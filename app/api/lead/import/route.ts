import { NextRequest, NextResponse } from 'next/server'

import prisma from '@/lib/prisma'
import { requireDatabaseRoles } from '@/lib/authz'
import { LeadAssignmentDepartment, LeadStage, Prisma } from '@/generated/prisma/client'
import { logLeadCreated } from '@/lib/activity-log-service'

export const runtime = 'nodejs'
export const preferredRegion = 'sin1'

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

type ImportBody = {
  mode?: unknown
  csvText?: unknown
  mapping?: unknown
}

type ParsedCsv = {
  headers: string[]
  rows: string[][]
}

type Mapping = Record<string, ImportField>

type RowIssue = {
  type: 'error' | 'warning'
  message: string
}

type AnalyzedRow = {
  rowNumber: number
  values: Record<string, string>
  mapped: {
    name: string | null
    phone: string | null
    email: string | null
    source: string | null
    location: string | null
    budget: number | null
    remarks: string | null
    assignedToEmail: string | null
    stage: LeadStage | null
  }
  issues: RowIssue[]
}

const IMPORT_FIELDS: ImportField[] = [
  'ignore',
  'name',
  'phone',
  'email',
  'source',
  'location',
  'budget',
  'remarks',
  'assignedToEmail',
  'stage',
]

const FIELD_ALIASES: Record<Exclude<ImportField, 'ignore'>, string[]> = {
  name: ['name', 'lead name', 'full name', 'customer name', 'client name'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number', 'whatsapp', 'whatsapp number', 'contact'],
  email: ['email', 'email address', 'mail'],
  source: ['source', 'lead source', 'channel', 'platform'],
  location: ['location', 'address', 'city', 'area'],
  budget: ['budget', 'amount', 'project budget', 'estimated budget', 'price'],
  remarks: ['remarks', 'remark', 'notes', 'note', 'comment', 'comments'],
  assignedToEmail: ['assigned to', 'assigned email', 'owner', 'agent email', 'jr crm email'],
  stage: ['stage', 'lead stage', 'status'],
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
}

function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = []
  let cell = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1
      row.push(cell)
      if (row.some((item) => item.trim().length > 0)) {
        rows.push(row)
      }
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  row.push(cell)
  if (row.some((item) => item.trim().length > 0)) {
    rows.push(row)
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] }
  }

  return {
    headers: rows[0].map((item) => item.trim()),
    rows: rows.slice(1),
  }
}

function autoDetectMapping(headers: string[]): Mapping {
  const used = new Set<ImportField>()
  const mapping: Mapping = {}

  for (const header of headers) {
    const normalizedHeader = normalizeKey(header)
    let matched: ImportField = 'ignore'

    for (const field of IMPORT_FIELDS) {
      if (field === 'ignore') continue
      if (used.has(field)) continue

      const aliases = FIELD_ALIASES[field]
      const isExact = aliases.some((alias) => normalizeKey(alias) === normalizedHeader)
      const isPartial = aliases.some((alias) => normalizedHeader.includes(normalizeKey(alias)))
      if (isExact || isPartial) {
        matched = field
        break
      }
    }

    if (matched !== 'ignore') used.add(matched)
    mapping[header] = matched
  }

  return mapping
}

function toPhone(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null
  return hasPlus ? `+${digits}` : digits
}

function toBudget(value: string | null): number | null {
  if (!value) return null
  const sanitized = value.replace(/[^\d.-]/g, '')
  if (!sanitized) return null
  const parsed = Number(sanitized)
  return Number.isFinite(parsed) ? parsed : null
}

function toStage(value: string | null): LeadStage | null {
  if (!value) return null
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '_')
  if (Object.values(LeadStage).includes(normalized as LeadStage)) {
    return normalized as LeadStage
  }
  return null
}

function buildValuesByHeader(headers: string[], row: string[]): Record<string, string> {
  const values: Record<string, string> = {}
  headers.forEach((header, index) => {
    values[header] = (row[index] ?? '').trim()
  })
  return values
}

function mapRow(values: Record<string, string>, mapping: Mapping): AnalyzedRow['mapped'] {
  const mapped: AnalyzedRow['mapped'] = {
    name: null,
    phone: null,
    email: null,
    source: null,
    location: null,
    budget: null,
    remarks: null,
    assignedToEmail: null,
    stage: null,
  }

  for (const [header, field] of Object.entries(mapping)) {
    const value = toOptionalString(values[header])
    switch (field) {
      case 'name':
        mapped.name = value
        break
      case 'phone':
        mapped.phone = toPhone(value)
        break
      case 'email':
        mapped.email = value?.toLowerCase() ?? null
        break
      case 'source':
        mapped.source = value
        break
      case 'location':
        mapped.location = value
        break
      case 'budget':
        mapped.budget = toBudget(value)
        break
      case 'remarks':
        mapped.remarks = value
        break
      case 'assignedToEmail':
        mapped.assignedToEmail = value?.toLowerCase() ?? null
        break
      case 'stage':
        mapped.stage = toStage(value)
        break
      case 'ignore':
      default:
        break
    }
  }

  return mapped
}

async function analyzeRows(
  headers: string[],
  rows: string[][],
  mapping: Mapping,
): Promise<{ analyzed: AnalyzedRow[]; summary: { total: number; valid: number; invalid: number; withWarnings: number } }> {
  const analyzed: AnalyzedRow[] = []
  const phones = new Set<string>()
  const duplicatePhonesInFile = new Set<string>()
  const assignedEmails = new Set<string>()

  for (const row of rows) {
    const values = buildValuesByHeader(headers, row)
    const mapped = mapRow(values, mapping)
    if (mapped.phone) {
      if (phones.has(mapped.phone)) duplicatePhonesInFile.add(mapped.phone)
      phones.add(mapped.phone)
    }
    if (mapped.assignedToEmail) assignedEmails.add(mapped.assignedToEmail)
    analyzed.push({ rowNumber: analyzed.length + 2, values, mapped, issues: [] })
  }

  const existingPhones = phones.size
    ? new Set(
        (
          await prisma.lead.findMany({
            where: { phone: { in: Array.from(phones) } },
            select: { phone: true },
          })
        )
          .map((row) => row.phone)
          .filter((value): value is string => Boolean(value)),
      )
    : new Set<string>()

  const assignableUsers = assignedEmails.size
    ? await prisma.user.findMany({
        where: {
          email: { in: Array.from(assignedEmails) },
          userDepartments: {
            some: {
              department: { name: 'JR_CRM' },
            },
          },
        },
        select: { email: true },
      })
    : []

  const assignableEmails = new Set(assignableUsers.map((user) => user.email.toLowerCase()))

  for (const row of analyzed) {
    const issues: RowIssue[] = []
    if (!row.mapped.name) issues.push({ type: 'error', message: 'Missing required field: name' })
    if (!row.mapped.source) {
      issues.push({ type: 'warning', message: 'Source missing. "Imported CSV" will be used.' })
    }
    if (row.mapped.phone && duplicatePhonesInFile.has(row.mapped.phone)) {
      issues.push({ type: 'error', message: 'Duplicate phone number exists in this file.' })
    }
    if (row.mapped.phone && existingPhones.has(row.mapped.phone)) {
      issues.push({ type: 'error', message: 'Phone already exists in CRM.' })
    }
    if (row.mapped.assignedToEmail && !assignableEmails.has(row.mapped.assignedToEmail)) {
      issues.push({ type: 'warning', message: 'Assigned email not found in JR_CRM. Lead will stay unassigned.' })
    }
    if (Object.values(mapping).includes('stage') && !row.mapped.stage) {
      issues.push({ type: 'warning', message: 'Invalid stage value. Default stage rules will apply.' })
    }
    row.issues = issues
  }

  const summary = analyzed.reduce(
    (acc, row) => {
      acc.total += 1
      const hasError = row.issues.some((issue) => issue.type === 'error')
      const hasWarning = row.issues.some((issue) => issue.type === 'warning')
      if (hasError) acc.invalid += 1
      else acc.valid += 1
      if (hasWarning) acc.withWarnings += 1
      return acc
    },
    { total: 0, valid: 0, invalid: 0, withWarnings: 0 },
  )

  return { analyzed, summary }
}

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export async function POST(request: NextRequest) {
  const authResult = await requireDatabaseRoles([])
  if (!authResult.ok) return authResult.response

  let body: ImportBody
  try {
    body = (await request.json()) as ImportBody
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const mode = toOptionalString(body.mode)
  const csvText = toOptionalString(body.csvText)
  if (!mode || (mode !== 'preview' && mode !== 'import')) {
    return NextResponse.json({ success: false, error: 'mode must be "preview" or "import"' }, { status: 400 })
  }
  if (!csvText) {
    return NextResponse.json({ success: false, error: 'csvText is required' }, { status: 400 })
  }

  const parsed = parseCsv(csvText)
  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'CSV appears empty or invalid.' }, { status: 400 })
  }

  const incomingMapping =
    body.mapping && typeof body.mapping === 'object' ? (body.mapping as Record<string, unknown>) : null

  const autoMapping = autoDetectMapping(parsed.headers)
  const mapping: Mapping = {}
  for (const header of parsed.headers) {
    const requested = incomingMapping?.[header]
    const requestedField =
      typeof requested === 'string' && IMPORT_FIELDS.includes(requested as ImportField)
        ? (requested as ImportField)
        : null
    mapping[header] = requestedField ?? autoMapping[header] ?? 'ignore'
  }

  const { analyzed, summary } = await analyzeRows(parsed.headers, parsed.rows, mapping)

  if (mode === 'preview') {
    return NextResponse.json({
      success: true,
      data: {
        headers: parsed.headers,
        mapping,
        fieldOptions: IMPORT_FIELDS,
        summary,
        previewRows: analyzed.slice(0, 50),
      },
    })
  }

  const assignableUsers = await prisma.user.findMany({
    where: {
      userDepartments: {
        some: {
          department: { name: 'JR_CRM' },
        },
      },
    },
    select: { id: true, email: true },
  })
  const assignableByEmail = new Map(assignableUsers.map((user) => [user.email.toLowerCase(), user.id]))

  const createdLeadIds: string[] = []
  let skipped = 0

  for (const row of analyzed) {
    if (row.issues.some((issue) => issue.type === 'error')) {
      skipped += 1
      continue
    }

    const source = row.mapped.source ?? 'Imported CSV'
    const stage = row.mapped.stage ?? (row.mapped.phone ? LeadStage.NUMBER_COLLECTED : LeadStage.NEW)
    const assignedToId = row.mapped.assignedToEmail ? assignableByEmail.get(row.mapped.assignedToEmail) ?? null : null

    try {
      await prisma.$transaction(async (tx) => {
        const lead = await tx.lead.create({
          data: {
            name: row.mapped.name!,
            phone: row.mapped.phone,
            email: row.mapped.email,
            source,
            location: row.mapped.location,
            budget: row.mapped.budget,
            remarks: row.mapped.remarks,
            stage,
            assignedTo: assignedToId,
          },
          select: { id: true, name: true },
        })

        if (assignedToId) {
          await tx.leadAssignment.create({
            data: {
              leadId: lead.id,
              userId: assignedToId,
              department: LeadAssignmentDepartment.JR_CRM,
            },
          })
        }

        await logLeadCreated(tx, {
          leadId: lead.id,
          userId: authResult.actorUserId,
          leadName: lead.name,
        })

        createdLeadIds.push(lead.id)
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        skipped += 1
        continue
      }
      throw error
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      created: createdLeadIds.length,
      skipped,
      total: analyzed.length,
      createdLeadIds,
      summary,
    },
    message: `${createdLeadIds.length} leads created from import`,
  })
}
