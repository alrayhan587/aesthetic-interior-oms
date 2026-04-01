import { randomUUID } from 'crypto'
import { put } from '@vercel/blob'
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
    const fileType = fileEntry.type || 'application/octet-stream'
    const blob = await put(`leads/${leadId}/${storedFileName}`, fileEntry, {
      access: 'public',
      contentType: fileType,
    })

    const attachment = await prisma.leadAttachment.create({
      data: {
        leadId,
        url: blob.url,
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
    if (error instanceof Error && error.message.includes('BLOB_READ_WRITE_TOKEN')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Blob storage is not configured. Set BLOB_READ_WRITE_TOKEN in environment variables.',
        },
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
