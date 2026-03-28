import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@/generated/prisma/client'
import prisma from '@/lib/prisma'

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

async function resolveLeadId(context: RouteContext): Promise<string | null> {
  const resolvedParams = await context.params
  const id = resolvedParams?.id

  if (typeof id !== 'string') return null

  const trimmed = id.trim()
  return trimmed.length > 0 ? trimmed : null
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function getCategory(fileType: string): 'MEDIA' | 'FILE' {
  if (fileType.startsWith('image/') || fileType.startsWith('video/')) {
    return 'MEDIA'
  }

  return 'FILE'
}

const INLINE_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024

export async function GET(_request: NextRequest, context: RouteContext) {
  const leadId = await resolveLeadId(context)

  if (!leadId) {
    return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 })
  }

  try {
    const attachments = await prisma.leadAttachment.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: attachments,
      count: attachments.length,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
      })
    }
    console.error('[lead/:id/attachments][GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch attachments' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const leadId = await resolveLeadId(context)

  if (!leadId) {
    return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 })
  }

  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } })

    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const fileEntry = formData.get('file')

    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'Attachment file is required' },
        { status: 400 },
      )
    }

    if (!fileEntry.size) {
      return NextResponse.json(
        { success: false, error: 'Attachment file cannot be empty' },
        { status: 400 },
      )
    }

    const safeName = sanitizeFileName(fileEntry.name || 'attachment')
    const storedFileName = `${Date.now()}-${randomUUID()}-${safeName}`
    const relativeDir = path.join('uploads', 'leads', leadId)
    const uploadDir = path.join(process.cwd(), 'public', relativeDir)
    const fullPath = path.join(uploadDir, storedFileName)

    await mkdir(uploadDir, { recursive: true })

    const arrayBuffer = await fileEntry.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileType = fileEntry.type || 'application/octet-stream'
    let attachmentUrl = `/${relativeDir}/${storedFileName}`.replace(/\\/g, '/')

    try {
      await writeFile(fullPath, buffer)
    } catch (fileWriteError) {
      const nodeError = fileWriteError as NodeJS.ErrnoException
      const isReadOnlyFs =
        nodeError?.code === 'EROFS' ||
        nodeError?.code === 'EPERM' ||
        nodeError?.code === 'EACCES'

      if (!isReadOnlyFs) {
        throw fileWriteError
      }

      if (fileEntry.size > INLINE_ATTACHMENT_MAX_BYTES) {
        return NextResponse.json(
          {
            success: false,
            error:
              'File upload is not available in this deployment for large files yet. Configure external blob storage or upload files smaller than 5MB.',
          },
          { status: 400 },
        )
      }

      // Fallback for read-only production filesystems (e.g., serverless deployments).
      attachmentUrl = `data:${fileType};base64,${buffer.toString('base64')}`
    }

    const attachment = await prisma.leadAttachment.create({
      data: {
        leadId,
        url: attachmentUrl,
        fileName: fileEntry.name || safeName,
        fileType,
        category: getCategory(fileType),
        sizeBytes: fileEntry.size,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: attachment,
        message: 'Attachment uploaded successfully',
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      return NextResponse.json(
        { success: false, error: 'Attachments table is not ready yet. Please run migrations.' },
        { status: 503 },
      )
    }
    console.error('[lead/:id/attachments][POST] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to upload attachment' },
      { status: 500 },
    )
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
