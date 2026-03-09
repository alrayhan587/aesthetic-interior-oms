import prisma from '@/lib/prisma';
import { LeadStage, Prisma, LeadStatus } from '@/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { logLeadCreated } from '@/lib/activity-log-service';
import { requireDatabaseRoles } from '@/lib/authz';

/*
  POSTMAN TESTING DATA
  =====================
  
  GET - Fetch all leads
  =====================
  URL: http://localhost:3000/api/lead
  Method: GET
  Headers: 
    - Authorization: Bearer {token}
  
  Expected Success Response (200):
  {
    "success": true,
    "data": [
      {
        "id": "cmmhfdt160000vzwb5ai4ej2g",
        "name": "Moinul Islam",
        "phone": "+8801234567890",
        "email": "moinul@example.com",
        "source": "Website",
        "location": "Dhaka",
        "status": "NEW",
        "stage": "NEW",
        "budget": 500000,
        "created_at": "2026-03-09T08:03:54.636Z",
        "updated_at": "2026-03-09T08:03:54.636Z",
        "assignedTo": null,
        "assignee": null
      }
    ]
  }
  
  =====================
  POST - Create a new lead
  =====================
  URL: http://localhost:3000/api/lead
  Method: POST
  Headers: 
    - Content-Type: application/json
    - Authorization: Bearer {token}
  
  REQUIRED FIELDS: name, phone
  OPTIONAL FIELDS: email, source, location, budget
  
  Request Body (with email):
  {
    "name": "John Doe",
    "phone": "+1234567890",
    "email": "john@example.com",
    "source": "Website",
    "location": "New York",
    "budget": 500000
  }
  
  Request Body (without email - email is OPTIONAL):
  {
    "name": "Jane Smith",
    "phone": "+0987654321",
    "source": "Referral",
    "location": "Los Angeles"
  }
  
  Minimal Request Body (only required fields):
  {
    "name": "Bob Wilson",
    "phone": "+9876543210"
  }
  
  Example curl (with email):
  curl -X POST http://localhost:3000/api/lead \
    -H "Content-Type: application/json" \
    -d '{"name": "John Doe", "phone": "+1234567890", "email": "john@example.com"}'
  
  Example curl (without email - email is optional):
  curl -X POST http://localhost:3000/api/lead \
    -H "Content-Type: application/json" \
    -d '{"name": "Jane Smith", "phone": "+0987654321"}'
  
  Expected Success Response (201):
  {
    "success": true,
    "data": {
      "id": "cmmhfdt160000vzwb5ai4ej2g",
      "name": "John Doe",
      "phone": "+1234567890",
      "email": "john@example.com",
      "source": "Website",
      "location": "New York",
      "budget": 500000,
      "status": "NEW",
      "stage": "NEW",
      "created_at": "2026-03-09T10:00:00.000Z",
      "updated_at": "2026-03-09T10:00:00.000Z",
      "assignedTo": null,
      "assignee": null
    },
    "message": "Lead created successfully"
  }
  
  Expected Error Responses:
  - Missing required fields (400):
    {"success": false, "error": "Name and phone are required"}
  
  - Phone already exists (409):
    {"success": false, "error": "A lead with this phone number already exists"}
  
  - Server error (500):
    {"success": false, "error": "Failed to create lead"}
*/

// Type definition for the request body when creating a lead
type CreateLeadBody = {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  source?: unknown;
  location?: unknown;
  budget?: unknown;
};

// Utility function to safely convert unknown values to optional strings
// Returns null if value is not a string or is empty after trimming
function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Utility function to safely convert unknown values to optional numbers (for budget)
// Returns null if value is not a valid finite number
function toBudget(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// GET endpoint - Retrieve all leads from the database
// Returns leads ordered by creation date (newest first)
// Includes assignee information (user who the lead is assigned to)
export async function GET() {
  try {
    console.log('🔵 [GET /api/lead] - Request received');
    
    console.log('🔎 [GET /api/lead] - Fetching all leads');
    const leads = await prisma.lead.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        assignee: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
    console.log('📊 [GET /api/lead] - Found', leads.length, 'leads');

    return NextResponse.json({ success: true, data: leads });
  } catch (error) {
    console.error('❌ [GET /api/lead] - Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}

// POST endpoint - Create a new lead
// Validates required fields (name, phone) - EMAIL IS OPTIONAL
// Checks for duplicate phone numbers
// Automatically gets the current user from authentication
// Uses database transaction to ensure atomicity when creating lead and activity log
export async function POST(request: NextRequest) {
  try {
    console.log('🔵 [POST /api/lead] - Request received');
    
    // Verify user authentication and get user ID
    const authResult = await requireDatabaseRoles([]);
    console.log('✅ [POST /api/lead] - Auth passed');
    if (!authResult.ok) {
      return authResult.response;
    }
    console.log('🔐 [POST /api/lead] - Auth verified for user:', authResult.actorUserId);

    // Parse incoming JSON request body
    console.log('📝 [POST /api/lead] - Parsing request body');
    const body = (await request.json()) as CreateLeadBody;

    // Extract and validate required fields
    const name = toOptionalString(body.name);
    const phone = toOptionalString(body.phone);
    const email = toOptionalString(body.email)?.toLowerCase();
    console.log('📋 [POST /api/lead] - Extracted fields. Name:', name, 'Phone:', phone, 'Email:', email);

    // Return 400 error if required fields are missing or invalid
    if (!name || !phone) {
      return NextResponse.json(
        { success: false, error: 'Name and phone are required' },
        { status: 400 }
      );
    }

    // Check if a lead with the same phone already exists to prevent duplicates
    console.log('🔄 [POST /api/lead] - Checking for duplicate phone');
    const existingLead = await prisma.lead.findFirst({
      where: { phone },
      select: { id: true },
    });
    console.log('📊 [POST /api/lead] - Duplicate check result:', existingLead);

    // Return 409 Conflict if phone already exists
    if (existingLead) {
      return NextResponse.json(
        { success: false, error: 'A lead with this phone number already exists' },
        { status: 409 }
      );
    }

    // Create lead and activity log in a transaction
    // Transaction ensures both operations succeed or both fail
    console.log('💾 [POST /api/lead] - Creating lead and activity log in transaction');
    const lead = await prisma.$transaction(async (tx) => {
      // Create the new lead with validated data
      const newLead = await tx.lead.create({
        data: {
          name,
          phone,
          email,
          source: toOptionalString(body.source),
          location: toOptionalString(body.location),
          budget: toBudget(body.budget),
          status: LeadStatus.NEW,
          stage: LeadStage.NEW,
        },
        // Include assignee details in the response
        include: {
          assignee: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });
      console.log('✨ [POST /api/lead] - Lead created:', newLead.id);

      // Log the lead creation activity with the authenticated user
      console.log('📋 [POST /api/lead] - Logging lead creation activity');
      await logLeadCreated(tx, {
        leadId: newLead.id,
        userId: authResult.actorUserId,
        leadName: name,
      });

      return newLead;
    });
    console.log('✨ [POST /api/lead] - Lead and activity log created successfully');

    // Return 201 Created with the new lead data
    return NextResponse.json(
      { success: true, data: lead, message: 'Lead created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ [POST /api/lead] - Error:', error);

    // Handle specific Prisma unique constraint violation (P2002 error code)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'A lead with this phone number already exists' },
        { status: 409 }
      );
    }

    // Return generic 500 error for other unexpected errors
    return NextResponse.json(
      { success: false, error: 'Failed to create lead' },
      { status: 500 }
    );
  }
}