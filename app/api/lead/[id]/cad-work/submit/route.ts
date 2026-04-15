import { randomUUID } from 'crypto'
import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import {
  ActivityType,
  CadSubmissionFileType,
  LeadAssignmentDepartment,
  LeadPhaseTaskStatus,
  LeadPhaseType,
  LeadStage,
  LeadSubStatus,
  NotificationType,
} from '@/generated/prisma/client'
import prisma from '@/lib/prisma'
import { requireDatabaseRoles } from '@/lib/authz'
import {
  ALLOWED_CAD_UPLOAD_EXTENSIONS,
  ALLOWED_CAD_UPLOAD_MIME_TYPES,
  CAD_EXTENSION_CONTENT_TYPE_MAP,
  isCadSubmissionFileTypeValue,
  MAX_CAD_SUBMISSION_FILES,
  MAX_CAD_SUBMISSION_FILE_SIZE_BYTES,
  sanitizeCadFileName,
  getCadFileExtension,
} from '@/lib/cad-work'
import { logActivity, logLeadStageChanged, logLeadSubStatusChanged } from '@/lib/activity-log-service'

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

async function resolveLeadId(context: RouteContext): Promise<string | null> {
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

function toLeadAttachmentCategory(fileType: string): 'MEDIA' | 'FILE' {
  if (fileType.startsWith('image/') || fileType.startsWith('video/')) {
    return 'MEDIA'
  }
  return 'FILE'
}

function isAllowedCadUploadFile(file: File): boolean {
  const fileType = (file.type || '').trim().toLowerCase()
  if (fileType && ALLOWED_CAD_UPLOAD_MIME_TYPES.has(fileType)) {
    return true
  }
  const extension = getCadFileExtension(file.name || '')
  return ALLOWED_CAD_UPLOAD_EXTENSIONS.has(extension)
}

async function uploadCadFileToBlob(input: {
  leadId: string
  file: File
}): Promise<{ url: string; fileName: string; fileType: string }> {
  const safeName = sanitizeCadFileName(input.file.name || 'cad-file')
  const storedFileName = `${Date.now()}-${randomUUID()}-${safeName}`
  const extension = getCadFileExtension(input.file.name || '')
  const resolvedFileType =
    input.file.type || CAD_EXTENSION_CONTENT_TYPE_MAP[extension] || 'application/octet-stream'

  const blob = await put(`cad-work-submissions/${input.leadId}/${storedFileName}`, input.file, {
    access: 'public',
    contentType: resolvedFileType,
  })

  return {
    url: blob.url,
    fileName: input.file.name || safeName,
    fileType: resolvedFileType,
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) return authResult.response

    const leadId = await resolveLeadId(context)
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 })
    }

    const actorDepartments = new Set(authResult.actor.userDepartments ?? [])
    const isAdmin = actorDepartments.has('ADMIN')
    const isSeniorCrm = actorDepartments.has('SR_CRM')
    const isJrArchitect = actorDepartments.has('JR_ARCHITECT')

    if (!isAdmin && !isSeniorCrm && !isJrArchitect) {
      return NextResponse.json(
        { success: false, error: 'Only JR Architect, Senior CRM, or Admin can submit CAD work' },
        { status: 403 },
      )
    }

    const formData = await request.formData()
    const note = toOptionalString(formData.get('note'))
    const files = formData
      .getAll('files')
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)
    const cadFileTypesRaw = formData
      .getAll('cadFileTypes')
      .map((entry) => toOptionalString(entry))
      .filter((entry): entry is string => Boolean(entry))

    if (files.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one file is required' }, { status: 400 })
    }

    if (files.length > MAX_CAD_SUBMISSION_FILES) {
      return NextResponse.json(
        { success: false, error: `A maximum of ${MAX_CAD_SUBMISSION_FILES} files is allowed` },
        { status: 400 },
      )
    }

    if (cadFileTypesRaw.length !== files.length) {
      return NextResponse.json(
        { success: false, error: 'Each uploaded file must include a selected CAD file type' },
        { status: 400 },
      )
    }

    const cadFileTypes: CadSubmissionFileType[] = []
    for (const value of cadFileTypesRaw) {
      const normalized = value.toUpperCase()
      if (!isCadSubmissionFileTypeValue(normalized)) {
        return NextResponse.json(
          { success: false, error: `Invalid CAD file type "${value}"` },
          { status: 400 },
        )
      }
      cadFileTypes.push(normalized as CadSubmissionFileType)
    }

    for (const file of files) {
      if (file.size > MAX_CAD_SUBMISSION_FILE_SIZE_BYTES) {
        return NextResponse.json(
          {
            success: false,
            error: `File "${file.name}" exceeds the ${Math.floor(
              MAX_CAD_SUBMISSION_FILE_SIZE_BYTES / (1024 * 1024),
            )}MB limit`,
          },
          { status: 400 },
        )
      }
      if (!isAllowedCadUploadFile(file)) {
        return NextResponse.json(
          {
            success: false,
            error: `File "${file.name}" type "${file.type || 'unknown'}" is not allowed`,
          },
          { status: 400 },
        )
      }
    }

    const payload = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({
        where: {
          id: leadId,
          ...(isAdmin || isSeniorCrm
            ? {}
            : {
                assignments: {
                  some: {
                    userId: authResult.actorUserId,
                    department: LeadAssignmentDepartment.JR_ARCHITECT,
                  },
                },
              }),
        },
        select: {
          id: true,
          name: true,
          stage: true,
          subStatus: true,
          assignments: {
            where: { department: LeadAssignmentDepartment.SR_CRM },
            select: { userId: true },
          },
        },
      })

      if (!lead) {
        throw new Error('LEAD_NOT_FOUND')
      }

      if (lead.subStatus === LeadSubStatus.CAD_COMPLETED || lead.subStatus === LeadSubStatus.CAD_APPROVED) {
        throw new Error('ALREADY_SUBMITTED')
      }

      if (!(lead.stage === LeadStage.CAD_PHASE && lead.subStatus === LeadSubStatus.CAD_WORKING)) {
        throw new Error('WORK_NOT_STARTED')
      }

      const submission = await tx.cadWorkSubmission.create({
        data: {
          leadId: lead.id,
          submittedById: authResult.actorUserId,
          note,
        },
      })

      const now = new Date()
      const uploadedFiles = []
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        const cadFileType = cadFileTypes[index]
        const uploaded = await uploadCadFileToBlob({ leadId: lead.id, file })
        uploadedFiles.push(uploaded)

        await tx.cadWorkSubmissionFile.create({
          data: {
            submissionId: submission.id,
            url: uploaded.url,
            fileName: uploaded.fileName,
            fileType: uploaded.fileType,
            cadFileType,
            sizeBytes: file.size,
          },
        })

        await tx.leadAttachment.create({
          data: {
            leadId: lead.id,
            url: uploaded.url,
            fileName: uploaded.fileName,
            fileType: uploaded.fileType,
            category: toLeadAttachmentCategory(uploaded.fileType),
            sizeBytes: file.size,
          },
        })
      }

      await tx.leadPhaseTask.updateMany({
        where: {
          leadId: lead.id,
          phaseType: LeadPhaseType.CAD,
          status: LeadPhaseTaskStatus.OPEN,
        },
        data: {
          status: LeadPhaseTaskStatus.IN_REVIEW,
          updatedAt: now,
        },
      })

      const updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          stage: LeadStage.CAD_PHASE,
          subStatus: LeadSubStatus.CAD_COMPLETED,
        },
        select: {
          id: true,
          stage: true,
          subStatus: true,
        },
      })

      if (lead.stage !== LeadStage.CAD_PHASE) {
        await logLeadStageChanged(tx, {
          leadId: lead.id,
          userId: authResult.actorUserId,
          from: lead.stage,
          to: LeadStage.CAD_PHASE,
          reason: 'CAD work submitted for review',
        })
      }

      await logLeadSubStatusChanged(tx, {
        leadId: lead.id,
        userId: authResult.actorUserId,
        from: lead.subStatus,
        to: LeadSubStatus.CAD_COMPLETED,
        reason: 'JR Architect submitted CAD files',
      })

      await logActivity(tx, {
        leadId: lead.id,
        userId: authResult.actorUserId,
        type: ActivityType.NOTE,
        description: `CAD work submitted with ${files.length} file${files.length === 1 ? '' : 's'} for Senior CRM review.`,
      })

      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)

      const adminUsers = await tx.user.findMany({
        where: {
          isActive: true,
          userDepartments: {
            some: {
              department: { name: 'ADMIN' },
            },
          },
        },
        select: { id: true },
      })

      const targetUserIds = Array.from(
        new Set([...lead.assignments.map((item) => item.userId), ...adminUsers.map((item) => item.id)]),
      ).filter((userId) => userId !== authResult.actorUserId)

      if (targetUserIds.length > 0) {
        const existingToday = await tx.notification.findMany({
          where: {
            userId: { in: targetUserIds },
            leadId: lead.id,
            type: NotificationType.LEAD_ASSIGNED_TO_YOU,
            title: 'CAD work submitted for review',
            createdAt: { gte: startOfToday },
          },
          select: { userId: true },
        })
        const existingUsers = new Set(existingToday.map((item) => item.userId))

        const notifications = targetUserIds
          .filter((userId) => !existingUsers.has(userId))
          .map((userId) => ({
            userId,
            leadId: lead.id,
            type: NotificationType.LEAD_ASSIGNED_TO_YOU,
            title: 'CAD work submitted for review',
            message: `${lead.name} CAD files are ready in Review Center.`,
            scheduledFor: now,
          }))

        if (notifications.length > 0) {
          await tx.notification.createMany({ data: notifications })
        }
      }

      return {
        lead: updatedLead,
        submissionId: submission.id,
      }
    })

    return NextResponse.json(
      {
        success: true,
        data: payload,
        message: 'CAD files submitted successfully and moved to CAD Completed',
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'LEAD_NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: 'Lead not found or not assigned to you' },
        { status: 404 },
      )
    }

    if (error instanceof Error && error.message === 'WORK_NOT_STARTED') {
      return NextResponse.json(
        { success: false, error: 'Please click Start Work before submitting CAD files' },
        { status: 409 },
      )
    }

    if (error instanceof Error && error.message === 'ALREADY_SUBMITTED') {
      return NextResponse.json(
        { success: false, error: 'CAD work has already been submitted for this lead' },
        { status: 409 },
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

    console.error('[lead/:id/cad-work/submit][POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to submit CAD work' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'POST, OPTIONS' },
  })
}
