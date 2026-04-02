import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { ActivityType, LeadStage, ProjectStatus } from '@/generated/prisma/client'
import prisma from '@/lib/prisma'
import { requireDatabaseRoles } from '@/lib/authz'
import { autoCompletePendingFollowups } from '@/lib/followup-auto-complete'
import { logActivity, logLeadStageChanged } from '@/lib/activity-log-service'

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

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

    return NextResponse.json({
      success: true,
      data: {
        leadResult: result,
        supportResults,
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
    const supportProjectStatus = toOptionalString(formData.get('supportProjectStatus'))
    const supportExtraConcern = toOptionalString(formData.get('supportExtraConcern'))

    if (formData.get('projectStatus') !== null && !projectStatus) {
      return NextResponse.json(
        { success: false, error: 'projectStatus must be UNDER_CONSTRUCTION or READY' },
        { status: 400 },
      )
    }

    const files = formData
      .getAll('files')
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)

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
          },
          lead: {
            select: { stage: true },
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
      const isAssignedLeader = visit.assignedToId === authResult.actorUserId
      const shouldSubmitSupport =
        resultType === 'SUPPORT' || (!isAssignedLeader && Boolean(supportAssignment))
      const shouldSubmitLead = resultType === 'LEAD' || isAssignedLeader

      if (!shouldSubmitLead && !shouldSubmitSupport) {
        throw new Error('NOT_ASSIGNED')
      }

      if (shouldSubmitSupport && supportAssignment) {
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

        if (existingSupportResult) {
          throw new Error('SUPPORT_RESULT_EXISTS')
        }

        const createdSupportResult = await tx.visitSupportResult.create({
          data: {
            visitId: visit.id,
            supportAssignmentId: supportAssignment.id,
            supportUserId: authResult.actorUserId,
            clientName: supportClientName,
            projectArea: supportProjectArea,
            projectStatus: supportProjectStatus,
            extraConcern: supportExtraConcern,
          },
        })

        if (files.length > 0) {
          const relativeDir = path.join('uploads', 'visit-support-results', visitId)
          const uploadDir = path.join(process.cwd(), 'public', relativeDir)
          await mkdir(uploadDir, { recursive: true })

          for (const file of files) {
            const safeName = sanitizeFileName(file.name || 'attachment')
            const storedFileName = `${Date.now()}-${randomUUID()}-${safeName}`
            const fullPath = path.join(uploadDir, storedFileName)
            const arrayBuffer = await file.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            await writeFile(fullPath, buffer)

            const url = `/${relativeDir}/${storedFileName}`.replace(/\\/g, '/')

            await tx.supportAttachment.create({
              data: {
                supportResultId: createdSupportResult.id,
                url,
                fileName: file.name || safeName,
                fileType: file.type || 'application/octet-stream',
              },
            })

            await tx.leadAttachment.create({
              data: {
                leadId: visit.leadId,
                url,
                fileName: file.name || safeName,
                fileType: file.type || 'application/octet-stream',
                category: getLeadAttachmentCategory(file.type || 'application/octet-stream'),
                sizeBytes: file.size,
              },
            })
          }
        }

        await logActivity(tx, {
          leadId: visit.leadId,
          userId: authResult.actorUserId,
          type: ActivityType.NOTE,
          description: `Support visit data submitted for visit ${visit.id}.`,
        })

        return tx.visitSupportResult.findUnique({
          where: { id: createdSupportResult.id },
          include: {
            files: { orderBy: { createdAt: 'desc' } },
            supportUser: { select: { id: true, fullName: true, email: true } },
          },
        })
      }

      if (!summary) {
        throw new Error('LEAD_SUMMARY_REQUIRED')
      }
      if (visit.result) {
        throw new Error('RESULT_EXISTS')
      }
      if (isVisitTeam && !isAdmin && !isAssignedLeader) {
        throw new Error('NOT_ASSIGNED')
      }
      const pendingSupportCount = visit.supportAssignments.filter((item) => !item.result).length
      if (pendingSupportCount > 0) {
        throw new Error('SUPPORT_PENDING')
      }

      const createdResult = await tx.visitResult.create({
        data: {
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

      if (files.length > 0) {
        const relativeDir = path.join('uploads', 'visit-results', visitId)
        const uploadDir = path.join(process.cwd(), 'public', relativeDir)
        await mkdir(uploadDir, { recursive: true })

        for (const file of files) {
          const safeName = sanitizeFileName(file.name || 'attachment')
          const storedFileName = `${Date.now()}-${randomUUID()}-${safeName}`
          const fullPath = path.join(uploadDir, storedFileName)
          const arrayBuffer = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          await writeFile(fullPath, buffer)

          const url = `/${relativeDir}/${storedFileName}`.replace(/\\/g, '/')

          await tx.attachment.create({
            data: {
              visitResultId: createdResult.id,
              url,
              fileName: file.name || safeName,
              fileType: file.type || 'application/octet-stream',
            },
          })

          await tx.leadAttachment.create({
            data: {
              leadId: visit.leadId,
              url,
              fileName: file.name || safeName,
              fileType: file.type || 'application/octet-stream',
              category: getLeadAttachmentCategory(file.type || 'application/octet-stream'),
              sizeBytes: file.size,
            },
          })
        }
      }

      if (visit.lead.stage !== LeadStage.VISIT_COMPLETED) {
        await tx.lead.update({
          where: { id: visit.leadId },
          data: {
            stage: LeadStage.VISIT_COMPLETED,
            subStatus: null,
          },
        })

        await logLeadStageChanged(tx, {
          leadId: visit.leadId,
          userId: authResult.actorUserId,
          from: visit.lead.stage,
          to: LeadStage.VISIT_COMPLETED,
          reason: 'Visit result submitted',
        })
      }

      await logActivity(tx, {
        leadId: visit.leadId,
        userId: authResult.actorUserId,
        type: ActivityType.NOTE,
        description: `Visit ${visit.id} marked completed with a submitted visit result.`,
      })

      await autoCompletePendingFollowups(tx, {
        leadId: visit.leadId,
        userId: authResult.actorUserId,
        action: 'visit completed',
      })

      return tx.visitResult.findUnique({
        where: { id: createdResult.id },
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
    })

    return NextResponse.json(
      {
        success: true,
        data: result,
        message:
          resultType === 'SUPPORT'
            ? 'Support visit data submitted successfully'
            : 'Visit result submitted successfully',
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'VISIT_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Visit schedule not found' }, { status: 404 })
    }

    if (error instanceof Error && error.message === 'RESULT_EXISTS') {
      return NextResponse.json(
        { success: false, error: 'Visit result already exists for this visit' },
        { status: 409 },
      )
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

    if (error instanceof Error && error.message === 'SUPPORT_RESULT_EXISTS') {
      return NextResponse.json(
        { success: false, error: 'Support data already submitted for this visit' },
        { status: 409 },
      )
    }

    if (error instanceof Error && error.message === 'SUPPORT_PENDING') {
      return NextResponse.json(
        {
          success: false,
          error: 'Visit cannot be completed until all support members submit their support data.',
        },
        { status: 409 },
      )
    }

    if (error instanceof Error && error.message === 'NOT_ASSIGNED') {
      return NextResponse.json(
        { success: false, error: 'You can only submit results for visits assigned to you' },
        { status: 403 },
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
