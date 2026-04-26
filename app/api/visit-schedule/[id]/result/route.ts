import { randomUUID } from 'crypto'
import { head, put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { ActivityType, LeadStage, LeadSubStatus, Prisma, ProjectStatus } from '@/generated/prisma/client'
import prisma from '@/lib/prisma'
import { requireDatabaseRoles } from '@/lib/authz'
import { autoCompletePendingFollowups } from '@/lib/followup-auto-complete'
import { logActivity, logLeadStageChanged } from '@/lib/activity-log-service'
import { getVisitWorkflowControlState } from '@/lib/visit-workflow-control'

type RouteContext = { params: { id: string } | Promise<{ id: string }> }
const MAX_UPLOAD_FILES = 10
const MAX_UPLOAD_FILE_SIZE_BYTES = 10 * 1024 * 1024
const BLOB_UPLOAD_MAX_ATTEMPTS = 3
const BLOB_UPLOAD_RETRY_DELAY_MS = 350
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'video/mp4',
  'video/quicktime',
])
const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'heic',
  'heif',
  'pdf',
  'doc',
  'docx',
  'txt',
  'mp4',
  'mov',
])
const EXTENSION_CONTENT_TYPE_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
}

async function resolveVisitId(context: RouteContext): Promise<string | null> {
  const resolvedParams = await context.params
  const id = resolvedParams?.id

  if (typeof id !== 'string') return null

  const trimmed = id.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function getFileExtension(fileName: string): string {
  const safeName = (fileName || '').trim().toLowerCase()
  const dotIndex = safeName.lastIndexOf('.')
  if (dotIndex === -1 || dotIndex === safeName.length - 1) return ''
  return safeName.slice(dotIndex + 1)
}

async function uploadFileToBlob(
  keyPrefix: string,
  file: File,
): Promise<{ url: string; fileName: string; fileType: string }> {
  const safeName = sanitizeFileName(file.name || 'attachment')
  const storedFileName = `${Date.now()}-${randomUUID()}-${safeName}`
  const extension = getFileExtension(file.name || '')
  const fileType = file.type || EXTENSION_CONTENT_TYPE_MAP[extension] || 'application/octet-stream'
  const blob = await put(`${keyPrefix}/${storedFileName}`, file, {
    access: 'public',
    contentType: fileType,
  })

  return {
    url: blob.url,
    fileName: file.name || safeName,
    fileType,
  }
}

function waitMs(duration: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, duration))
}

async function uploadFileToBlobWithRetry(
  keyPrefix: string,
  file: File,
): Promise<{ url: string; fileName: string; fileType: string }> {
  let lastError: unknown = null
  for (let attempt = 1; attempt <= BLOB_UPLOAD_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await uploadFileToBlob(keyPrefix, file)
    } catch (error) {
      lastError = error
      if (attempt < BLOB_UPLOAD_MAX_ATTEMPTS) {
        await waitMs(BLOB_UPLOAD_RETRY_DELAY_MS * attempt)
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Upload failed')
}

type UploadedFileMeta = {
  url: string
  fileName: string
  fileType: string
  sizeBytes: number
}

type FailedUploadMeta = {
  fileName: string
  reason: string
}

async function uploadFilesToBlob(
  keyPrefix: string,
  files: File[],
): Promise<{ uploadedFiles: UploadedFileMeta[]; failedUploads: FailedUploadMeta[] }> {
  if (files.length === 0) {
    return { uploadedFiles: [], failedUploads: [] }
  }

  const settled = await Promise.allSettled(
    files.map((file) => uploadFileToBlobWithRetry(keyPrefix, file)),
  )

  const uploadedFiles: UploadedFileMeta[] = []
  const failedUploads: FailedUploadMeta[] = []

  settled.forEach((result, index) => {
    const inputFile = files[index]
    if (result.status === 'fulfilled') {
      uploadedFiles.push({
        ...result.value,
        sizeBytes: inputFile.size,
      })
      return
    }

    const reason =
      result.reason instanceof Error
        ? result.reason.message
        : 'Temporary upload failure'
    failedUploads.push({
      fileName: inputFile.name || `file-${index + 1}`,
      reason,
    })
  })

  return { uploadedFiles, failedUploads }
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

function getLeadAttachmentCategory(fileType: string): 'MEDIA' | 'FILE' {
  if (fileType.startsWith('image/') || fileType.startsWith('video/')) {
    return 'MEDIA'
  }
  return 'FILE'
}

function toProjectStatus(value: unknown): ProjectStatus | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return Object.values(ProjectStatus).includes(normalized as ProjectStatus)
    ? (normalized as ProjectStatus)
    : null
}

function toOptionalNumber(value: string | null): number | null {
  if (!value) return null
  const normalized = value.replace(/,/g, '').trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function isAllowedUploadType(fileType: string): boolean {
  if (!fileType) return false
  if (fileType.startsWith('image/')) return true
  return ALLOWED_UPLOAD_MIME_TYPES.has(fileType)
}

function isAllowedUploadFile(file: File): boolean {
  const fileType = file.type || ''
  if (isAllowedUploadType(fileType)) return true

  // iOS/Safari can send empty or generic types; fallback to extension allow-list.
  const extension = getFileExtension(file.name || '')
  return ALLOWED_UPLOAD_EXTENSIONS.has(extension)
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const visitId = await resolveVisitId(context)
    if (!visitId) {
      return NextResponse.json({ success: false, error: 'Invalid visit schedule id' }, { status: 400 })
    }

    const result = await prisma.visitResult.findUnique({
      where: { visitId },
      include: {
        files: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    const supportResults = await prisma.visitSupportResult.findMany({
      where: { visitId },
      include: {
        supportUser: {
          select: { id: true, fullName: true, email: true },
        },
        files: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { completedAt: 'desc' },
    })

    if (!result && supportResults.length === 0) {
      return NextResponse.json({ success: false, error: 'Visit result not found' }, { status: 404 })
    }

    const leadResultWithReadableUrls = result
      ? {
          ...result,
          files: await Promise.all(
            result.files.map(async (item) => ({
              ...item,
              url: await resolveAttachmentReadUrl(item.url),
            })),
          ),
        }
      : null

    const supportResultsWithReadableUrls = await Promise.all(
      supportResults.map(async (supportResult) => ({
        ...supportResult,
        files: await Promise.all(
          supportResult.files.map(async (item) => ({
            ...item,
            url: await resolveAttachmentReadUrl(item.url),
          })),
        ),
      })),
    )

    return NextResponse.json({
      success: true,
      data: {
        leadResult: leadResultWithReadableUrls,
        supportResults: supportResultsWithReadableUrls,
      },
    })
  } catch (error) {
    console.error('[visit-schedule/:id/result][GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch visit result' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const visitId = await resolveVisitId(context)
    if (!visitId) {
      return NextResponse.json({ success: false, error: 'Invalid visit schedule id' }, { status: 400 })
    }

    const actor = await prisma.user.findUnique({
      where: { id: authResult.actorUserId },
      select: {
        id: true,
        userDepartments: {
          select: {
            department: { select: { name: true } },
          },
        },
      },
    })

    const departments = new Set((actor?.userDepartments ?? []).map((row) => row.department.name))
    const isVisitTeam = departments.has('VISIT_TEAM')
    const isAdmin = departments.has('ADMIN')

    if (!isVisitTeam && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only visit team can submit visit results' },
        { status: 403 },
      )
    }

    const formData = await request.formData()
    const visitWorkflow = await getVisitWorkflowControlState()
    const summary = toOptionalString(formData.get('summary'))
    const clientMood = toOptionalString(formData.get('clientMood'))
    const note = toOptionalString(formData.get('note'))
    const projectStatus = toProjectStatus(formData.get('projectStatus'))
    const resultType = toOptionalString(formData.get('resultType'))?.toUpperCase()
    const clientPotentiality = toOptionalString(formData.get('clientPotentiality'))
    const projectType = toOptionalString(formData.get('projectType'))
    const clientPersonality = toOptionalString(formData.get('clientPersonality'))
    const budgetRange = toOptionalString(formData.get('budgetRange'))
    const timelineUrgency = toOptionalString(formData.get('timelineUrgency'))
    const stylePreference = toOptionalString(formData.get('stylePreference'))
    const supportClientName = toOptionalString(formData.get('supportClientName'))
    const supportProjectArea = toOptionalString(formData.get('supportProjectArea'))
    const supportProjectStatus = toProjectStatus(formData.get('supportProjectStatus'))
    const supportExtraConcern = toOptionalString(formData.get('supportExtraConcern'))
    const parsedSupportProjectArea = toOptionalNumber(supportProjectArea)

    if (formData.get('projectStatus') !== null && !projectStatus) {
      return NextResponse.json(
        { success: false, error: 'projectStatus must be UNDER_CONSTRUCTION or READY' },
        { status: 400 },
      )
    }
    if (formData.get('supportProjectStatus') !== null && !supportProjectStatus) {
      return NextResponse.json(
        { success: false, error: 'supportProjectStatus must be UNDER_CONSTRUCTION or READY' },
        { status: 400 },
      )
    }

    const files = formData
      .getAll('files')
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)
    if (files.length > MAX_UPLOAD_FILES) {
      return NextResponse.json(
        { success: false, error: `A maximum of ${MAX_UPLOAD_FILES} files is allowed` },
        { status: 400 },
      )
    }
    for (const file of files) {
      if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
        return NextResponse.json(
          {
            success: false,
            error: `File "${file.name}" exceeds the ${Math.floor(MAX_UPLOAD_FILE_SIZE_BYTES / (1024 * 1024))}MB limit`,
          },
          { status: 400 },
        )
      }
      if (!isAllowedUploadFile(file)) {
        return NextResponse.json(
          {
            success: false,
            error: `File "${file.name}" type "${file.type || 'unknown'}" is not allowed`,
          },
          { status: 400 },
        )
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const visit = await tx.visit.findUnique({
        where: { id: visitId },
        select: {
          id: true,
          leadId: true,
          assignedToId: true,
          supportAssignments: {
            include: {
              result: { select: { id: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
          lead: {
            select: { stage: true, subStatus: true, name: true },
          },
          result: {
            select: { id: true },
          },
        },
      })

      if (!visit) {
        throw new Error('VISIT_NOT_FOUND')
      }

      const supportAssignment = visit.supportAssignments.find(
        (item) => item.supportUserId === authResult.actorUserId,
      )
      const primarySupportAssignment = visit.supportAssignments[0] ?? null
      const isPrimarySupportMember =
        primarySupportAssignment?.supportUserId === authResult.actorUserId
      const isAssignedLeader = visit.assignedToId === authResult.actorUserId
      const shouldSubmitSupport =
        resultType === 'SUPPORT' || (!isAssignedLeader && isPrimarySupportMember)
      const shouldSubmitLead = resultType === 'LEAD' || isAssignedLeader

      if (!shouldSubmitLead && !shouldSubmitSupport) {
        throw new Error('NOT_ASSIGNED')
      }

      if (resultType === 'SUPPORT' && !supportAssignment) {
        throw new Error('NOT_ASSIGNED')
      }
      if (
        supportAssignment &&
        !isPrimarySupportMember &&
        (resultType === 'SUPPORT' || !isAssignedLeader)
      ) {
        throw new Error('SUPPORT_PRIMARY_ONLY')
      }

      if (shouldSubmitSupport && supportAssignment) {
        if (!visitWorkflow.supportDataEnabled) {
          throw new Error('SUPPORT_DISABLED')
        }

        if (!supportClientName || !supportProjectArea || !supportProjectStatus) {
          throw new Error('SUPPORT_FIELDS_REQUIRED')
        }

        const existingSupportResult = await tx.visitSupportResult.findUnique({
          where: {
            visitId_supportUserId: {
              visitId: visit.id,
              supportUserId: authResult.actorUserId,
            },
          },
          select: { id: true },
        })

        const supportResult = await tx.visitSupportResult.upsert({
          where: {
            visitId_supportUserId: {
              visitId: visit.id,
              supportUserId: authResult.actorUserId,
            },
          },
          create: {
            visitId: visit.id,
            supportAssignmentId: supportAssignment.id,
            supportUserId: authResult.actorUserId,
            clientName: supportClientName,
            projectArea: supportProjectArea,
            projectStatus: supportProjectStatus,
            extraConcern: supportExtraConcern,
          },
          update: {
            supportAssignmentId: supportAssignment.id,
            clientName: supportClientName,
            projectArea: supportProjectArea,
            projectStatus: supportProjectStatus,
            extraConcern: supportExtraConcern,
            completedAt: new Date(),
          },
        })

        const nextVisitUpdate: Prisma.VisitUncheckedUpdateInput = {}
        if (parsedSupportProjectArea !== null) {
          nextVisitUpdate.projectSqft = parsedSupportProjectArea
        }
        if (supportProjectStatus) {
          nextVisitUpdate.projectStatus = supportProjectStatus
        }
        if (Object.keys(nextVisitUpdate).length > 0) {
          await tx.visit.update({
            where: { id: visit.id },
            data: nextVisitUpdate,
          })
        }

        if (supportClientName !== visit.lead.name) {
          await tx.lead.update({
            where: { id: visit.leadId },
            data: { name: supportClientName },
          })
        }

        const { uploadedFiles: uploadedSupportFiles, failedUploads } = await uploadFilesToBlob(
          `visit-support-results/${visitId}`,
          files,
        )
        for (const uploaded of uploadedSupportFiles) {
          await tx.supportAttachment.create({
            data: {
              supportResultId: supportResult.id,
              url: uploaded.url,
              fileName: uploaded.fileName,
              fileType: uploaded.fileType,
            },
          })

          await tx.leadAttachment.create({
            data: {
              leadId: visit.leadId,
              url: uploaded.url,
              fileName: uploaded.fileName,
              fileType: uploaded.fileType,
              category: getLeadAttachmentCategory(uploaded.fileType),
              sizeBytes: uploaded.sizeBytes,
            },
          })
        }

        await logActivity(tx, {
          leadId: visit.leadId,
          userId: authResult.actorUserId,
          type: ActivityType.NOTE,
          description: existingSupportResult
            ? `Support visit data updated for visit ${visit.id}.`
            : `Support visit data submitted for visit ${visit.id}.`,
        })

        const savedSupportResult = await tx.visitSupportResult.findUnique({
          where: { id: supportResult.id },
          include: {
            files: { orderBy: { createdAt: 'desc' } },
            supportUser: { select: { id: true, fullName: true, email: true } },
          },
        })

        return {
          kind: 'SUPPORT' as const,
          updated: Boolean(existingSupportResult),
          payload: savedSupportResult,
          failedUploads,
        }
      }

      if (isVisitTeam && !isAdmin && !isAssignedLeader) {
        throw new Error('NOT_ASSIGNED')
      }
      if (!summary) {
        throw new Error('LEAD_SUMMARY_REQUIRED')
      }
      const isPrimarySupportPending =
        visitWorkflow.supportDataEnabled && Boolean(primarySupportAssignment && !primarySupportAssignment.result)
      if (isPrimarySupportPending) {
        throw new Error('SUPPORT_PENDING')
      }

      const hadLeadResult = Boolean(visit.result)
      const savedResult = await tx.visitResult.upsert({
        where: { visitId },
        create: {
          visitId,
          summary,
          clientMood,
          clientPotentiality,
          projectType,
          clientPersonality,
          budgetRange,
          timelineUrgency,
          stylePreference,
        },
        update: {
          summary,
          clientMood,
          clientPotentiality,
          projectType,
          clientPersonality,
          budgetRange,
          timelineUrgency,
          stylePreference,
          completedAt: new Date(),
        },
      })

      await tx.visit.update({
        where: { id: visit.id },
        data: {
          status: 'COMPLETED',
          ...(projectStatus ? { projectStatus } : {}),
        },
      })

      if (note) {
        await tx.note.create({
          data: {
            leadId: visit.leadId,
            userId: authResult.actorUserId,
            content: note,
          },
        })
      }

      const { uploadedFiles: uploadedLeadFiles, failedUploads } = await uploadFilesToBlob(
        `visit-results/${visitId}`,
        files,
      )
      for (const uploaded of uploadedLeadFiles) {
        await tx.attachment.create({
          data: {
            visitResultId: savedResult.id,
            url: uploaded.url,
            fileName: uploaded.fileName,
            fileType: uploaded.fileType,
          },
        })

        await tx.leadAttachment.create({
          data: {
            leadId: visit.leadId,
            url: uploaded.url,
            fileName: uploaded.fileName,
            fileType: uploaded.fileType,
            category: getLeadAttachmentCategory(uploaded.fileType),
            sizeBytes: uploaded.sizeBytes,
          },
        })
      }

      if (visit.lead.stage !== LeadStage.VISIT_PHASE || visit.lead.subStatus !== LeadSubStatus.VISIT_COMPLETED) {
        await tx.lead.update({
          where: { id: visit.leadId },
          data: {
            stage: LeadStage.VISIT_PHASE,
            subStatus: LeadSubStatus.VISIT_COMPLETED,
          },
        })

        await logLeadStageChanged(tx, {
          leadId: visit.leadId,
          userId: authResult.actorUserId,
          from: visit.lead.stage,
          to: LeadStage.VISIT_PHASE,
          reason: 'Visit result submitted',
        })
      }

      await logActivity(tx, {
        leadId: visit.leadId,
        userId: authResult.actorUserId,
        type: ActivityType.NOTE,
        description: hadLeadResult
          ? `Visit result updated for visit ${visit.id}.`
          : `Visit ${visit.id} marked completed with a submitted visit result.`,
      })

      if (!hadLeadResult) {
        await autoCompletePendingFollowups(tx, {
          leadId: visit.leadId,
          userId: authResult.actorUserId,
          action: 'visit completed',
        })
      }

      const leadResult = await tx.visitResult.findUnique({
        where: { id: savedResult.id },
        include: {
          files: {
            orderBy: { createdAt: 'desc' },
          },
          visit: {
            select: {
              id: true,
              status: true,
              leadId: true,
            },
          },
        },
      })

      return {
        kind: 'LEAD' as const,
        updated: hadLeadResult,
        payload: leadResult,
        failedUploads,
      }
    }, {
      maxWait: 10_000,
      timeout: 60_000,
    })

    return NextResponse.json(
      {
        success: true,
        data: result.payload,
        message:
          result.kind === 'SUPPORT'
            ? result.updated
              ? 'Support visit data updated successfully'
              : 'Support visit data submitted successfully'
            : result.updated
              ? 'Visit result updated successfully'
              : 'Visit result submitted successfully',
        uploadWarnings:
          (result.failedUploads?.length ?? 0) > 0
            ? {
                failedCount: result.failedUploads.length,
                failedFiles: result.failedUploads.map((item) => item.fileName),
              }
            : null,
      },
      { status: result.updated ? 200 : 201 },
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'VISIT_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Visit schedule not found' }, { status: 404 })
    }

    if (error instanceof Error && error.message === 'LEAD_SUMMARY_REQUIRED') {
      return NextResponse.json({ success: false, error: 'Summary is required' }, { status: 400 })
    }

    if (error instanceof Error && error.message === 'SUPPORT_FIELDS_REQUIRED') {
      return NextResponse.json(
        {
          success: false,
          error: 'supportClientName, supportProjectArea and supportProjectStatus are required',
        },
        { status: 400 },
      )
    }

    if (error instanceof Error && error.message === 'SUPPORT_PENDING') {
      return NextResponse.json(
        {
          success: false,
          error: 'Visit cannot be completed until the first support member submits support data.',
        },
        { status: 409 },
      )
    }

    if (error instanceof Error && error.message === 'SUPPORT_PRIMARY_ONLY') {
      return NextResponse.json(
        {
          success: false,
          error: 'Only the first assigned support member can submit support data for this visit.',
        },
        { status: 403 },
      )
    }

    if (error instanceof Error && error.message === 'SUPPORT_DISABLED') {
      return NextResponse.json(
        {
          success: false,
          error: 'Support data submission is disabled by admin settings.',
        },
        { status: 403 },
      )
    }

    if (error instanceof Error && error.message === 'NOT_ASSIGNED') {
      return NextResponse.json(
        { success: false, error: 'You can only submit results for visits assigned to you' },
        { status: 403 },
      )
    }

    if (error instanceof Error && error.message.includes('BLOB_READ_WRITE_TOKEN')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Blob storage is not configured. Set BLOB_READ_WRITE_TOKEN in environment variables.',
        },
        { status: 503 },
      )
    }

    console.error('[visit-schedule/:id/result][POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to submit visit result' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'GET, POST, OPTIONS',
    },
  })
}
