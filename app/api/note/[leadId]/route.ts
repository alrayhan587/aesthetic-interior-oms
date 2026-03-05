// Import Next.js utilities for handling HTTP requests and responses
import { NextRequest, NextResponse } from 'next/server'
// Import Prisma database client for ORM operations
import prisma from '@/lib/prisma'

//here get all notes for a lead, create a note for a lead. The leadId is used to filter notes by lead and to associate new notes with the correct lead when creating them.

// Define route context type that handles both sync and async params (Next.js 15+ uses Promise-based params)
type RouteContext = { params: { leadId: string } | Promise<{ leadId: string }> }

// Pagination constants
const DEFAULT_PAGE = 1 // Default page number when not specified
const DEFAULT_LIMIT = 20 // Default number of items per page
const MAX_LIMIT = 100 // Maximum allowed items per page to prevent large queries

// Helper function to safely extract and validate leadId from route params
async function resolveLeadId(context: RouteContext): Promise<string | null> {
  // Await params to handle Next.js 15+ Promise-based params
  const resolvedParams = await context.params
  // Extract leadId from resolved params (using optional chaining for safety)
  const leadId = resolvedParams?.leadId

  // Type check: if leadId is not a string, return null
  if (typeof leadId !== 'string') return null

  // Remove whitespace from leadId
  const trimmed = leadId.trim()
  // Return leadId only if it's not empty, otherwise return null
  return trimmed.length > 0 ? trimmed : null
}

// Helper function to parse and validate positive integers (used for pagination)
function toPositiveInt(value: string | null, fallback: number): number {
  // Parse the value as integer, using empty string as fallback if value is null
  const parsed = Number.parseInt(value ?? '', 10)
  // Return parsed value only if it's finite and positive, otherwise return fallback
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

// GET endpoint to retrieve all notes for a specific lead with pagination support
export async function GET(request: NextRequest, context: RouteContext) {
  // Safely extract and validate leadId from route parameters
  const leadId = await resolveLeadId(context)

  // Return 400 error if leadId is missing or invalid
  if (!leadId) {
    return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 })
  }

  try {
    // Extract query parameters from the request URL
    const { searchParams } = new URL(request.url)
    // Get page number, default to 1 if not provided or invalid
    const page = toPositiveInt(searchParams.get('page'), DEFAULT_PAGE)
    // Get desired limit, default to 20 if not provided or invalid
    const parsedLimit = toPositiveInt(searchParams.get('limit'), DEFAULT_LIMIT)
    // Cap the limit at MAX_LIMIT (100) to prevent excessively large queries
    const limit = Math.min(parsedLimit, MAX_LIMIT)
    // Calculate how many records to skip based on page and limit (for pagination)
    const skip = (page - 1) * limit

    // Verify that the lead exists in the database before retrieving its notes
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } })
    // Return 404 error if lead doesn't exist
    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    // Execute two database queries in parallel for efficiency
    const [notes, total] = await Promise.all([
      // Query 1: Fetch paginated notes for this lead
      prisma.note.findMany({
        where: { leadId }, // Filter notes by leadId
        include: {
          // Include related lead data
          lead: {
            select: { id: true, name: true, email: true },
          },
          // Include related user (author) data
          user: {
            select: { id: true, fullName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' }, // Sort notes by newest first
        skip, // Skip records for pagination
        take: limit, // Limit results per page
      }),
      // Query 2: Count total notes for this lead (used for pagination info)
      prisma.note.count({ where: { leadId } }),
    ])

    // Return successful response with notes and pagination info
    return NextResponse.json({
      success: true, // Indicate successful operation
      data: notes, // Array of notes for the lead
      pagination: {
        page, // Current page number
        limit, // Items per page
        total, // Total count of all notes for this lead
        totalPages: Math.ceil(total / limit), // Calculate total pages needed
      },
    })
  } catch (error: unknown) {
    // Log error to console for debugging
    console.error('Error fetching lead notes:', error)
    // Return 500 error response with error details
    return NextResponse.json(
      {
        success: false, // Indicate operation failed
        error: 'Failed to fetch lead notes', // Generic error message
        message: error instanceof Error ? error.message : 'Unknown error', // Specific error message if available
      },
      { status: 500 } // HTTP 500 Internal Server Error
    )
  }
}

// POST endpoint to create a new note for a specific lead
export async function POST(request: NextRequest, context: RouteContext) {
  // Safely extract and validate leadId from route parameters
  const leadId = await resolveLeadId(context)

  // Return 400 error if leadId is missing or invalid
  if (!leadId) {
    return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 })
  }

  try {
    // Parse the JSON request body
    const body = await request.json()
    // Extract and trim userId, default to empty string if not provided or not a string
    const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
    // Extract and trim content, default to empty string if not provided or not a string
    const content = typeof body.content === 'string' ? body.content.trim() : ''

    // Validate that both userId and content are provided and non-empty
    if (!userId || !content) {
      // Return 400 error if validation fails
      return NextResponse.json(
        { success: false, error: 'userId and content are required' },
        { status: 400 }
      )
    }

    // Verify that both the lead and user exist before creating the note
    const [lead, user] = await Promise.all([
      // Check if lead exists
      prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } }),
      // Check if user (note author) exists
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    ])

    // Return 404 error if lead doesn't exist
    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    // Return 404 error if user doesn't exist
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Create the note in the database with associated lead and user data
    const note = await prisma.note.create({
      data: {
        leadId, // Link note to the specific lead
        userId, // Link note to the user who created it
        content, // The note content
      },
      include: {
        // Include lead information in response
        lead: {
          select: { id: true, name: true, email: true },
        },
        // Include user information in response
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    })

    // Return 201 Created response with the newly created note
    return NextResponse.json(
      { success: true, data: note, message: 'Note created successfully' },
      { status: 201 } // HTTP 201 Created
    )
  } catch (error: unknown) {
    // Log error to console for debugging
    console.error('Error creating note:', error)
    // Return 500 error response with error details
    return NextResponse.json(
      {
        success: false, // Indicate operation failed
        error: 'Failed to create note', // Generic error message
        message: error instanceof Error ? error.message : 'Unknown error', // Specific error message if available
      },
      { status: 500 } // HTTP 500 Internal Server Error
    )
  }
}