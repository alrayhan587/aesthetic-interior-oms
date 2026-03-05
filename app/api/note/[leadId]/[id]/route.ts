import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

//Here get the note by id, update the note by id and delete the note by id. The leadId is not used in this route but is part of the route structure for consistency with other note-related routes.


// Route context for accessing dynamic route parameters [leadId] and [id]
type RouteContext = { params: { id: string } | Promise<{ id: string }> }

// Type for request body when updating notes
type UpdateNoteBody = {
  content?: unknown
}

// Safely extract and validate note ID from route parameters
async function resolveNoteId(context: RouteContext): Promise<string | null> {
  const resolved = await context.params
  const id = resolved?.id

  if (typeof id !== 'string') return null

  const trimmed = id.trim()
  return trimmed.length > 0 ? trimmed : null
}

// Convert and validate a value to a non-empty string, or return null
function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

// Reusable query to include related lead and user data on note responses
const noteInclude = {
  lead: {
    select: { id: true, name: true, email: true },
  },
  user: {
    select: { id: true, fullName: true, email: true },
  },
} as const

// GET - Retrieve a single note by ID with related lead and user information
//GET /api/note/[leadId]/[id]
export async function GET(_request: NextRequest, context: RouteContext) {
  const id = await resolveNoteId(context)

  if (!id) {
    return NextResponse.json({ success: false, error: 'Invalid note id' }, { status: 400 })
  }

  try {
    const note = await prisma.note.findUnique({
      where: { id },
      include: noteInclude,
    })

    if (!note) {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: note })
  } catch (error) {
    console.error('Error fetching note:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch note' }, { status: 500 })
  }
}

// PUT - Full update: replaces the entire note content (requires content field)
//PUT /api/note/[leadId]/[id]
export async function PUT(request: NextRequest, context: RouteContext) {
  const id = await resolveNoteId(context)

  if (!id) {
    return NextResponse.json({ success: false, error: 'Invalid note id' }, { status: 400 })
  }

  try {
    const body = (await request.json()) as UpdateNoteBody
    const content = toOptionalString(body.content)

    if (!content) {
      return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 })
    }

    const existingNote = await prisma.note.findUnique({ where: { id }, select: { id: true } })
    if (!existingNote) {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 })
    }

    const note = await prisma.note.update({
      where: { id },
      data: { content },
      include: noteInclude,
    })

    return NextResponse.json({
      success: true,
      data: note,
      message: 'Note updated successfully',
    })
  } catch (error) {
    console.error('Error updating note:', error)
    return NextResponse.json({ success: false, error: 'Failed to update note' }, { status: 500 })
  }
}

// PATCH - Partial update: only updates fields that are provided in the request body
export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = await resolveNoteId(context)

  if (!id) {
    return NextResponse.json({ success: false, error: 'Invalid note id' }, { status: 400 })
  }

  try {
    const body = (await request.json()) as UpdateNoteBody
    const updateData: { content?: string } = {}

    if (body.content !== undefined) {
      const content = toOptionalString(body.content)
      if (!content) {
        return NextResponse.json(
          { success: false, error: 'Content must be a non-empty string when provided' },
          { status: 400 },
        )
      }
      updateData.content = content
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields provided for update' },
        { status: 400 },
      )
    }

    const existingNote = await prisma.note.findUnique({ where: { id }, select: { id: true } })
    if (!existingNote) {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 })
    }

    const note = await prisma.note.update({
      where: { id },
      data: updateData,
      include: noteInclude,
    })

    return NextResponse.json({
      success: true,
      data: note,
      message: 'Note updated successfully',
    })
  } catch (error) {
    console.error('Error partially updating note:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update note' },
      { status: 500 },
    )
  }
}

// DELETE - Remove a note from the database
//DELETE /api/note/[leadId]/[id]
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = await resolveNoteId(context)

  if (!id) {
    return NextResponse.json({ success: false, error: 'Invalid note id' }, { status: 400 })
  }

  try {
    const existingNote = await prisma.note.findUnique({ where: { id }, select: { id: true } })
    if (!existingNote) {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 })
    }

    await prisma.note.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: 'Note deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting note:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete note' }, { status: 500 })
  }
}

