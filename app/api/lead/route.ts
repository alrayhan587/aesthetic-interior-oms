import prisma from '@/lib/prisma';
import { LeadAssignmentDepartment, LeadStage, Prisma } from '@/generated/prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { logLeadCreated } from '@/lib/activity-log-service';
import { requireDatabaseRoles } from '@/lib/authz';
import { formatServerTiming, timeAsync } from '@/lib/server-timing';
import { isFacebookConfigured } from '@/lib/facebook';
import { maybeRunFacebookFallbackSync, runFacebookSyncWithControl } from '@/lib/facebook-sync-control';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';

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
  assignedToId?: unknown;
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

function toLeadStageParam(value: string | null): LeadStage | null {
  const normalized = toOptionalString(value);
  if (!normalized || normalized === 'ALL') return null;
  const upper = normalized.toUpperCase();
  return Object.values(LeadStage).includes(upper as LeadStage) ? (upper as LeadStage) : null;
}

function toPositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function parseDateAtStartOfDayUtc(value: string | null): Date | null {
  const normalized = toOptionalString(value);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateAtEndOfDayUtc(value: string | null): Date | null {
  const normalized = toOptionalString(value);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// GET endpoint - Retrieve leads from the database (paginated)
export async function GET(request: NextRequest) {
  const requestStart = performance.now();
  try {
    // console.log('🔵 [GET /api/lead] - Request received');

    const timedAuth = await timeAsync(async () => requireDatabaseRoles([]));
    const authResult = timedAuth.value;
    if (!authResult.ok) {
      return authResult.response;
    }

    const departmentNames = new Set(authResult.actor.userDepartments ?? []);
    const isJuniorCrm = departmentNames.has('JR_CRM');
    const isAdmin = departmentNames.has('ADMIN');

    const baseWhere: Prisma.LeadWhereInput = isAdmin
      ? {}
      : isJuniorCrm
        ? {
            assignments: {
              some: {
                userId: authResult.actorUserId,
                department: LeadAssignmentDepartment.JR_CRM,
              },
            },
          }
        : {};

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(toPositiveInt(searchParams.get('limit'), 20), 100);
    const offset = toPositiveInt(searchParams.get('offset'), 0);
    const stageParam = toLeadStageParam(searchParams.get('stage'));
    const searchParam = toOptionalString(searchParams.get('search'));
    const createdFrom = parseDateAtStartOfDayUtc(searchParams.get('createdFrom'));
    const createdTo = parseDateAtEndOfDayUtc(searchParams.get('createdTo'));
    const hasCreatedFromParam = Boolean(toOptionalString(searchParams.get('createdFrom')));
    const hasCreatedToParam = Boolean(toOptionalString(searchParams.get('createdTo')));

    if ((hasCreatedFromParam && !createdFrom) || (hasCreatedToParam && !createdTo)) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format. Use YYYY-MM-DD for createdFrom/createdTo.' },
        { status: 400 },
      );
    }

    if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
      return NextResponse.json(
        { success: false, error: 'createdFrom must be before or equal to createdTo.' },
        { status: 400 },
      );
    }

    const createdAtWhere: Prisma.DateTimeFilter | undefined =
      createdFrom || createdTo
        ? {
            ...(createdFrom ? { gte: createdFrom } : {}),
            ...(createdTo ? { lte: createdTo } : {}),
          }
        : undefined;

    const where: Prisma.LeadWhereInput = {
      ...baseWhere,
      ...(stageParam ? { stage: stageParam } : {}),
      ...(createdAtWhere ? { created_at: createdAtWhere } : {}),
      ...(searchParam
        ? {
            OR: [
              { name: { contains: searchParam, mode: 'insensitive' } },
              { email: { contains: searchParam, mode: 'insensitive' } },
              { phone: { contains: searchParam, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    let facebookTimingMetric = '';
    const syncFacebookFlag = request.nextUrl.searchParams.get('syncFacebook') === '1';
    const hasCreatedDateFilter = Boolean(createdAtWhere);
    const shouldSyncFacebook =
      syncFacebookFlag &&
      offset === 0 &&
      !searchParam &&
      !stageParam &&
      !hasCreatedDateFilter &&
      isFacebookConfigured();

    const shouldRunFallbackFacebookSync =
      offset === 0 &&
      !searchParam &&
      !stageParam &&
      !hasCreatedDateFilter;

    if (shouldRunFallbackFacebookSync) {
      try {
        await maybeRunFacebookFallbackSync();
      } catch (syncError) {
        console.error('[GET /api/lead] Facebook fallback sync failed:', syncError);
      }
    }

    if (shouldSyncFacebook) {
      try {
        const timedFacebookSync = await timeAsync(async () =>
          runFacebookSyncWithControl('MANUAL'),
        );
        const syncResult = timedFacebookSync.value;
        facebookTimingMetric = formatServerTiming(
          'fb_sync',
          timedFacebookSync.durationMs,
          `created=${syncResult.createdLeads},fetched=${syncResult.fetchedConversations}`,
        );
      } catch (syncError) {
        console.error('[GET /api/lead] Facebook sync failed:', syncError);
      }
    }

    const timedDb = await timeAsync(async () => {
      const [total, leads, groupedStageCounts] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.findMany({
          where,
          orderBy: { created_at: 'desc' },
          include: {
            assignments: {
              where: { department: LeadAssignmentDepartment.JR_CRM },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                user: { select: { id: true, fullName: true, email: true } },
              },
            },
          },
          skip: offset,
          take: limit,
        }),
        prisma.lead.groupBy({
          by: ['stage'],
          where: {
            ...baseWhere,
            ...(createdAtWhere ? { created_at: createdAtWhere } : {}),
          },
          _count: { stage: true },
        }),
      ]);
      return { total, leads, groupedStageCounts };
    });

    const { total, leads, groupedStageCounts } = timedDb.value;

    const stageCounts = Object.values(LeadStage).reduce<Record<string, number>>((acc, stage) => {
      const grouped = groupedStageCounts.find((entry) => entry.stage === stage);
      acc[stage] = grouped?._count.stage ?? 0;
      return acc;
    }, {});

    const nextOffset = offset + leads.length;
    const hasMore = nextOffset < total;

    // console.log('📊 [GET /api/lead] - Found', leads.length, 'leads in page');

    const response = NextResponse.json({
      success: true,
      data: leads,
      meta: {
        total,
        limit,
        offset,
        nextOffset: hasMore ? nextOffset : null,
        hasMore,
        stageCounts,
      },
    });
    const totalDurationMs = performance.now() - requestStart;
    response.headers.set(
      'Server-Timing',
      [
        formatServerTiming('auth', timedAuth.durationMs, 'requireDatabaseRoles'),
        formatServerTiming('db', timedDb.durationMs, 'lead queries'),
        ...(facebookTimingMetric ? [facebookTimingMetric] : []),
        formatServerTiming('total', totalDurationMs, 'request total'),
      ].join(', '),
    );
    response.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=45');
    return response;
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
    // console.log('🔵 [POST /api/lead] - Request received');
    
    // Verify user authentication and get user ID
    const authResult = await requireDatabaseRoles([]);
    // console.log('✅ [POST /api/lead] - Auth passed');
    if (!authResult.ok) {
      return authResult.response;
    }
    // console.log('🔐 [POST /api/lead] - Auth verified for user:', authResult.actorUserId);

    // Parse incoming JSON request body
    // console.log('📝 [POST /api/lead] - Parsing request body');
    const body = (await request.json()) as CreateLeadBody;

    // Extract and validate required fields
    const name = toOptionalString(body.name);
    const phone = toOptionalString(body.phone);
    const email = toOptionalString(body.email)?.toLowerCase();
    const source = toOptionalString(body.source);
    const requestedAssigneeId = toOptionalString(body.assignedToId);
    // console.log('📋 [POST /api/lead] - Extracted fields. Name:', name, 'Phone:', phone, 'Email:', email);

    // Return 400 error if required fields are missing or invalid
    if (!name || !source) {
      return NextResponse.json(
        { success: false, error: 'Name and source are required' },
        { status: 400 }
      );
    }

    const actor = await prisma.user.findUnique({
      where: { id: authResult.actorUserId },
      select: {
        id: true,
        userDepartments: { select: { department: { select: { name: true } } } },
      },
    });

    const departmentNames = new Set(
      (actor?.userDepartments ?? []).map((row) => row.department.name),
    );
    const isJuniorCrm = departmentNames.has('JR_CRM');
    const isAdmin = departmentNames.has('ADMIN');

    let jrCrmAssigneeId = requestedAssigneeId;
    if (!jrCrmAssigneeId && isJuniorCrm && !isAdmin) {
      jrCrmAssigneeId = authResult.actorUserId;
    }

    if (phone) {
      // Check if a lead with the same phone already exists to prevent duplicates
      // console.log('🔄 [POST /api/lead] - Checking for duplicate phone');
      const existingLead = await prisma.lead.findFirst({
        where: { phone },
        select: { id: true },
      });
      // console.log('📊 [POST /api/lead] - Duplicate check result:', existingLead);

      // Return 409 Conflict if phone already exists
      if (existingLead) {
        return NextResponse.json(
          { success: false, error: 'A lead with this phone number already exists' },
          { status: 409 }
        );
      }
    }

    if (jrCrmAssigneeId) {
      const jrCrmUser = await prisma.user.findUnique({
        where: { id: jrCrmAssigneeId },
        select: {
          id: true,
          userDepartments: { select: { department: { select: { name: true } } } },
        },
      });

      const jrDepartments = new Set(
        (jrCrmUser?.userDepartments ?? []).map((row) => row.department.name),
      );

      if (!jrCrmUser || !jrDepartments.has('JR_CRM')) {
        return NextResponse.json(
          { success: false, error: 'Selected user is not mapped to JR_CRM department' },
          { status: 400 }
        );
      }
    }

    // Create lead and activity log in a transaction
    // Transaction ensures both operations succeed or both fail
    // console.log('💾 [POST /api/lead] - Creating lead and activity log in transaction');
    const lead = await prisma.$transaction(async (tx) => {
      const stage = phone ? LeadStage.NUMBER_COLLECTED : LeadStage.NEW

      // Create the new lead with validated data
      const newLead = await tx.lead.create({
        data: {
          name,
          phone: phone ?? null,
          email,
          source,
          location: toOptionalString(body.location),
          budget: toBudget(body.budget),
          stage,
          ...(jrCrmAssigneeId ? { assignedTo: jrCrmAssigneeId } : {}),
        },
        // Include assignee details in the response
        include: {
          assignee: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });
      // console.log('✨ [POST /api/lead] - Lead created:', newLead.id);

      if (jrCrmAssigneeId) {
        await tx.leadAssignment.create({
          data: {
            leadId: newLead.id,
            userId: jrCrmAssigneeId,
            department: LeadAssignmentDepartment.JR_CRM,
          },
        });
      }

      // Log the lead creation activity with the authenticated user
      // console.log('📋 [POST /api/lead] - Logging lead creation activity');
      await logLeadCreated(tx, {
        leadId: newLead.id,
        userId: authResult.actorUserId,
        leadName: name,
      });

      return newLead;
    });
    // console.log('✨ [POST /api/lead] - Lead and activity log created successfully');

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
