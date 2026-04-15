import { head } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { LeadAssignmentDepartment, Prisma } from '@/generated/prisma/client'
import prisma from '@/lib/prisma'
import { requireDatabaseRoles } from '@/lib/authz'

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toPositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

function toBooleanParam(value: string | null, fallback = false): boolean {
  const normalized = toOptionalString(value)?.toLowerCase()
  if (!normalized) return fallback
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

async function resolveAttachmentReadUrl(url: string): Promise<string> {
  if (!url.includes('.private.blob.vercel-storage.com')) return url
  try {
    const blobMeta = await head(url)
    return blobMeta.downloadUrl || url
  } catch {
    return url
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const actorDepartments = new Set(authResult.actor.userDepartments ?? [])
    const isAdmin = actorDepartments.has('ADMIN')
    const isSeniorCrm = actorDepartments.has('SR_CRM')

    if (!isAdmin && !isSeniorCrm) {
      return NextResponse.json(
        { success: false, error: 'Only Senior CRM or Admin can access review center' },
        { status: 403 },
      )
    }

    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(toPositiveInt(searchParams.get('limit'), 20), 60)
    const offset = toPositiveInt(searchParams.get('offset'), 0)
    const search = toOptionalString(searchParams.get('search'))
    const myLeadsOnly = toBooleanParam(searchParams.get('myLeadsOnly'), true)

    const scopeToAssignedSrLeads = !isAdmin || myLeadsOnly

    const where: Prisma.CadWorkSubmissionWhereInput = {
      ...(scopeToAssignedSrLeads
        ? {
            lead: {
              assignments: {
                some: {
                  userId: authResult.actorUserId,
                  department: LeadAssignmentDepartment.SR_CRM,
                },
              },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { lead: { name: { contains: search, mode: 'insensitive' } } },
              { lead: { phone: { contains: search, mode: 'insensitive' } } },
              { files: { some: { fileName: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    }

    const [total, submissions] = await Promise.all([
      prisma.cadWorkSubmission.count({ where }),
      prisma.cadWorkSubmission.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              phone: true,
              location: true,
              stage: true,
              subStatus: true,
            },
          },
          submittedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          files: {
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
    ])

    const withReadableUrls = await Promise.all(
      submissions.map(async (submission) => ({
        ...submission,
        files: await Promise.all(
          submission.files.map(async (file) => ({
            ...file,
            url: await resolveAttachmentReadUrl(file.url),
          })),
        ),
      })),
    )

    const nextOffset = offset + withReadableUrls.length
    const hasMore = nextOffset < total

    return NextResponse.json({
      success: true,
      data: withReadableUrls,
      meta: {
        total,
        limit,
        offset,
        nextOffset: hasMore ? nextOffset : null,
        hasMore,
      },
    })
  } catch (error) {
    console.error('[cad-work/review-center][GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch CAD review submissions' },
      { status: 500 },
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'GET, OPTIONS',
    },
  })
}
