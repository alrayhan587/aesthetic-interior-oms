// Import ActivityType and Prisma types from the generated Prisma client
import { ActivityType, Prisma } from '@/generated/prisma/client'
// Import the Prisma database instance to perform database operations
import prisma from '@/lib/prisma'
// Import Next.js HTTP request/response utilities for API route handling
import { NextRequest, NextResponse } from 'next/server'

const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') {
    // console.log(...args)
  }
}

// Default pagination page (starts at 1)
const DEFAULT_PAGE = 1
// Default number of records per page
const DEFAULT_LIMIT = 20
// Maximum allowed records per page to prevent excessive data fetching
const MAX_LIMIT = 100


// Helper function: Converts a string query parameter to a positive integer
// Used for pagination to ensure valid page and limit values
// Returns fallback number if the value is invalid, null, or non-positive
function toPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

// Helper function: Validates and converts a string to a valid ActivityType enum value
// Returns the ActivityType if valid, undefined otherwise
// This ensures only valid activity types are used in queries

// Valid ActivityType values: [ 'CALL', 'STATUS_CHANGE', 'NOTE', 'FOLLOWUP_SET' ]
function toActivityType(value: string | null): ActivityType | undefined {
  if (!value) return undefined
  debugLog('🔎 [toActivityType] Valid ActivityType values:', Object.values(ActivityType))
  debugLog('🔎 [toActivityType] Checking if', value, 'is in valid values')
  return Object.values(ActivityType).includes(value as ActivityType)
    ? (value as ActivityType)
    : undefined
}

// GET /api/activity-log - Fetch all activity logs with optional filtering and pagination
// Query Parameters:
//   - page: Page number for pagination (default: 1)
//   - limit: Number of records per page (default: 20, max: 100)
//   - leadId: Filter by specific lead ID (optional)
//   - userId: Filter by specific user ID (optional)
//   - type: Filter by activity type (optional)
export async function GET(request: NextRequest) {
  try {
    // Extract query parameters from the request URL
    const { searchParams } = new URL(request.url)

    // Parse pagination parameters, ensuring they are positive integers
    const page = toPositiveInt(searchParams.get('page'), DEFAULT_PAGE)
    const parsedLimit = toPositiveInt(searchParams.get('limit'), DEFAULT_LIMIT)
    const limit = Math.min(parsedLimit, MAX_LIMIT) // Prevent limit from exceeding MAX_LIMIT
    const skip = (page - 1) * limit // Calculate how many records to skip for the current page

    // Extract optional filtering parameters
    const leadId = searchParams.get('leadId')
    const userId = searchParams.get('userId')
    const type = toActivityType(searchParams.get('type'))

    // Build the WHERE clause for the database query
    // Only include filter conditions if they are provided
    const where: Prisma.ActivityLogWhereInput = {}
    if (leadId) where.leadId = leadId // Filter by lead if provided
    if (userId) where.userId = userId // Filter by user if provided
    if (type) where.type = type // Filter by activity type if provided

    // Execute two database queries in parallel for better performance
    // 1. Find activities with pagination and includes lead/user details
    // 2. Count total activities to calculate pagination metadata
    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where, // Apply filters
        include: {
          // Include related lead data
          lead: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          // Include related user data
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        skip, // Skip previous pages
        take: limit, // Limit results to page size
        orderBy: { createdAt: 'desc' }, // Sort by creation date (newest first)
      }),
      prisma.activityLog.count({ where }), // Count total matching records
    ])

    // Return success response with activity logs and pagination info
    return NextResponse.json({
      success: true,
      data: activities,
      pagination: {
        page, // Current page number
        limit, // Records per page
        total, // Total matching records
        totalPages: Math.ceil(total / limit), // Total number of pages
      },
    })
  } catch (error: unknown) {
    // Log error for debugging
    console.error('Error fetching activity logs:', error)
    // Return error response
    return NextResponse.json(
      { success: false, error: 'Failed to fetch activity logs', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST /api/activity-log - Create a new activity log entry
// Request body requires:
//   - leadId: ID of the lead this activity is related to (required)
//   - userId: ID of the user performing the activity (required)
//   - type: Activity type (must be a valid ActivityType enum value) (required)
//   - description: Description of the activity (required)
export async function POST(request: NextRequest) {
  try {
    // Parse JSON request body
    const body = await request.json()
    debugLog('📥 [POST /api/activity-log] Incoming request body:', JSON.stringify(body, null, 2))
    
    // Extract and validate request fields
    // Ensure each field is a string and has the correct type
    const leadId = typeof body.leadId === 'string' ? body.leadId : ''
    const userId = typeof body.userId === 'string' ? body.userId : ''
    const type = toActivityType(typeof body.type === 'string' ? body.type : null)
    const description = typeof body.description === 'string' ? body.description.trim() : ''

    debugLog('🔍 [POST /api/activity-log] Extracted fields:', {
      leadId: leadId || 'EMPTY',
      userId: userId || 'EMPTY',
      type: type || 'INVALID',
      description: description || 'EMPTY',
    })

    // Validate that all required fields are provided and non-empty
    if (!leadId || !userId || !type || !description) {
      console.warn('⚠️ [POST /api/activity-log] Validation failed - missing required fields')
      return NextResponse.json(
        { success: false, error: 'leadId, userId, type, and description are required' },
        { status: 400 }
      )
    }

    debugLog('✅ [POST /api/activity-log] Validation passed - checking database records')

    // Check if both the lead and user exist in the database
    // Use Promise.all for parallel execution to improve performance
    const [lead, user] = await Promise.all([
      prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    ])

    debugLog('🔎 [POST /api/activity-log] Database lookup results:', {
      leadFound: !!lead,
      leadId: leadId,
      userFound: !!user,
      userId: userId,
    })

    // Return 404 if the specified lead doesn't exist
    if (!lead) {
      console.error('❌ [POST /api/activity-log] Lead not found with ID:', leadId)
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    // Return 404 if the specified user doesn't exist
    if (!user) {
      console.error('❌ [POST /api/activity-log] User not found with ID:', userId)
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    debugLog('💾 [POST /api/activity-log] Creating activity log in database')

    // Create the activity log entry in the database
    const activity = await prisma.activityLog.create({
      data: {
        leadId, // Link to the lead
        userId, // Link to the user who created this activity
        type, // Activity type (e.g., FOLLOW_UP_SCHEDULED, NOTE_ADDED, etc.)
        description, // Description of what happened
      },
      // Include related lead and user information in the response
      include: {
        lead: {
          select: { id: true, name: true, email: true },
        },
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    })

    debugLog('✨ [POST /api/activity-log] Activity log created successfully:', {
      id: activity.id,
      leadId: activity.leadId,
      userId: activity.userId,
      type: activity.type,
      createdAt: activity.createdAt,
    })

    // Return success response with the created activity log and HTTP 201 (Created) status
    return NextResponse.json(
      { success: true, data: activity, message: 'Activity log created successfully' },
      { status: 201 }
    )
  } catch (error: unknown) {
    // Log error for debugging purposes
    console.error('💥 [POST /api/activity-log] Error:', error)
    if (error instanceof Error) {
      console.error('Error Details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      })
    }
    // Return error response with HTTP 500 (Internal Server Error) status
    return NextResponse.json(
      { success: false, error: 'Failed to create activity log', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
