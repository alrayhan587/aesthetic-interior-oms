/*
  POSTMAN TESTING DATA
  =====================
  
  BASE URL: http://localhost:3000/api/lead/{leadId}
  
  VALID LEAD STATUSES: NEW, INTERESTED, NEGOTIATION, WON, LOST, INACTIVE
  VALID LEAD STAGES: NEW, DESIGN_CONSULTATION, QUOTATION_PREPARED, NEGOTIATION, FINALIZED, WON, LOST
  
  =====================
  GET - Fetch a specific lead with all related data
  =====================
  URL: http://localhost:3000/api/lead/{leadId}
  Method: GET
  Headers: 
    - Authorization: Bearer {token}
  
  Example URL:
  http://localhost:3000/api/lead/cmmhfdt160000vzwb5ai4ej2g
  
  Example curl:
  curl -X GET http://localhost:3000/api/lead/cmmhfdt160000vzwb5ai4ej2g \
    -H "Authorization: Bearer {token}"
  
  Expected Success Response (200):
  {
    "success": true,
    "data": {
      "id": "cmmhfdt160000vzwb5ai4ej2g",
      "name": "Moinul Islam",
      "phone": "+8801234567890",
      "email": "moinul@example.com",
      "source": "Website",
      "location": "Dhaka",
      "status": "NEW",
      "stage": "NEW",
      "subStatus": null,
      "budget": 500000,
      "remarks": "Interested in interior design",
      "assignedTo": "user-456",
      "created_at": "2026-03-09T08:03:54.636Z",
      "updated_at": "2026-03-09T08:03:54.636Z",
      "assignee": {
        "id": "user-456",
        "fullName": "Sarah Smith",
        "email": "sarah@example.com"
      },
      "followUps": [],
      "notes": [],
      "activities": [],
      "statusHistory": []
    }
  }
  
  Expected Error: Lead not found (404):
  {"success": false, "error": "Lead not found"}
  
  =====================
  PUT - Full update of a lead (name and phone required)
  =====================
  URL: http://localhost:3000/api/lead/{leadId}
  Method: PUT
  Headers: 
    - Content-Type: application/json
    - Authorization: Bearer {token}
  
  REQUIRED FIELDS: name, phone
  OPTIONAL FIELDS: email, source, status, stage, subStatus, budget, location, remarks, assignedTo, userId
  
  Request Body (Full Update):
  {
    "name": "John Doe Updated",
    "phone": "+1234567890",
    "email": "john.updated@example.com",
    "source": "Referral",
    "status": "INTERESTED",
    "stage": "DESIGN_CONSULTATION",
    "subStatus": "AWAITING_QUOTE",
    "budget": 750000,
    "location": "New York",
    "remarks": "Updated remarks",
    "assignedTo": "user-789",
    "userId": "user-123"
  }
  
  Example curl (Full Update):
  curl -X PUT http://localhost:3000/api/lead/cmmhfdt160000vzwb5ai4ej2g \
    -H "Content-Type: application/json" \
    -d '{
      "name": "John Doe Updated",
      "phone": "+1234567890",
      "email": "john.updated@example.com",
      "status": "INTERESTED",
      "stage": "DESIGN_CONSULTATION",
      "userId": "user-123"
    }'
  
  Expected Success Response (200):
  {
    "success": true,
    "data": { ... updated lead data ... },
    "message": "Lead updated successfully"
  }
  
  Expected Error Responses:
  - Missing required fields (400):
    {"success": false, "error": "Name and phone are required"}
  
  - Lead not found (404):
    {"success": false, "error": "Lead not found"}
  
  - Duplicate email (409):
    {"success": false, "error": "A lead with this email already exists"}
  
  =====================
  PATCH - Partial update of a lead (only supplied fields)
  =====================
  URL: http://localhost:3000/api/lead/{leadId}
  Method: PATCH
  Headers: 
    - Content-Type: application/json
    - Authorization: Bearer {token}
  
  ALL FIELDS OPTIONAL - only send fields you want to update
  
  Request Body Examples:
  
  Example 1 - Update status only:
  {
    "status": "NEGOTIATION",
    "userId": "user-123"
  }
  
  Example 2 - Update stage and remarks:
  {
    "stage": "QUOTATION_PREPARED",
    "remarks": "Quote sent to client",
    "userId": "user-123"
  }
  
  Example 3 - Update budget and assigned user:
  {
    "budget": 1000000,
    "assignedTo": "user-789"
  }
  
  Example curl (Update status):
  curl -X PATCH http://localhost:3000/api/lead/cmmhfdt160000vzwb5ai4ej2g \
    -H "Content-Type: application/json" \
    -d '{
      "status": "NEGOTIATION",
      "userId": "user-123"
    }'
  
  Expected Success Response (200):
  {
    "success": true,
    "data": { ... patched lead data ... },
    "message": "Lead updated successfully"
  }
  
  Expected Error Responses:
  - Lead not found (404):
    {"success": false, "error": "Lead not found"}
  
  - Duplicate email (409):
    {"success": false, "error": "A lead with this email already exists"}
  
  - Invalid subStatus for stage (400):
    {"success": false, "error": "Invalid subStatus for selected stage"}
  
  =====================
  DELETE - Remove a lead permanently
  =====================
  URL: http://localhost:3000/api/lead/{leadId}
  Method: DELETE
  Headers: 
    - Authorization: Bearer {token}
  
  No request body needed
  
  Example curl:
  curl -X DELETE http://localhost:3000/api/lead/cmmhfdt160000vzwb5ai4ej2g \
    -H "Authorization: Bearer {token}"
  
  Expected Success Response (200):
  {
    "success": true,
    "message": "Lead deleted successfully"
  }
  
  Expected Error: Lead not found (404):
  {"success": false, "error": "Lead not found"}
  
  =====================
  POSTMAN COLLECTION SETUP
  =====================
  
  1. Create a new Collection: "Lead Management - Individual"
  2. Create four requests:
  
  Request 1: Get Lead
  - Name: GET - Fetch Lead
  - Method: GET
  - URL: {{baseUrl}}/api/lead/{{leadId}}
  - Headers: Authorization: Bearer {{token}}
  
  Request 2: Update Lead (Full)
  - Name: PUT - Full Update Lead
  - Method: PUT
  - URL: {{baseUrl}}/api/lead/{{leadId}}
  - Body (raw JSON): {"name": "{{leadName}}", "phone": "{{leadPhone}}", "email": "{{leadEmail}}", "status": "INTERESTED", "userId": "{{userId}}"}
  - Headers: Content-Type: application/json, Authorization: Bearer {{token}}
  
  Request 3: Update Lead (Partial)
  - Name: PATCH - Partial Update Lead
  - Method: PATCH
  - URL: {{baseUrl}}/api/lead/{{leadId}}
  - Body (raw JSON): {"status": "NEGOTIATION", "userId": "{{userId}}"}
  - Headers: Content-Type: application/json, Authorization: Bearer {{token}}
  
  Request 4: Delete Lead
  - Name: DELETE - Remove Lead
  - Method: DELETE
  - URL: {{baseUrl}}/api/lead/{{leadId}}
  - Headers: Authorization: Bearer {{token}}
  
  3. Set collection variables:
  - baseUrl: http://localhost:3000
  - leadId: cmmhfdt160000vzwb5ai4ej2g
  - leadName: John Doe
  - leadPhone: +1234567890
  - leadEmail: john@example.com
  - userId: cmmhf6aef0003pku3125gleqh
  - token: your_auth_token
*/

import prisma from '@/lib/prisma';
import { LeadStage, LeadSubStatus, Prisma } from '@/generated/prisma/client';
import { isSubStatusAllowedForStage } from '@/lib/lead-stage';
import { NextRequest, NextResponse } from 'next/server';
import { logLeadAssignmentChanged, logLeadStatusChanged } from '@/lib/activity-log-service';
import { autoCompletePendingFollowups } from '@/lib/followup-auto-complete';
import { formatServerTiming, timeAsync } from '@/lib/server-timing';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

type UpdateLeadBody = {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  source?: unknown;
  
  stage?: unknown;
  subStatus?: unknown;
  budget?: unknown;
  location?: unknown;
  remarks?: unknown;
  assignedTo?: unknown;
  userId?: unknown;
};

async function resolveLeadId(context: RouteContext): Promise<string | null> {
  const resolvedParams = await context.params;
  const id = resolvedParams?.id;

  if (typeof id !== 'string') return null;

  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toRequiredString(value: unknown): string | null {
  const normalized = toOptionalString(value);
  return normalized && normalized.length > 0 ? normalized : null;
}

function toBudget(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIncludeFlag(value: string | null, defaultValue = true): boolean {
  if (value === null) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  return defaultValue;
}



function toLeadStage(value: unknown): LeadStage | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return LeadStage.NEW;
  const normalized = value.trim().toUpperCase();
  return Object.values(LeadStage).includes(normalized as LeadStage)
    ? (normalized as LeadStage)
    : LeadStage.NEW;
}

function toLeadSubStatus(value: unknown): LeadSubStatus | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toUpperCase();
  return Object.values(LeadSubStatus).includes(normalized as LeadSubStatus)
    ? (normalized as LeadSubStatus)
    : null;
}

// GET /api/lead/[id] - fetch one lead with related CRM timeline details
export async function GET(_request: NextRequest, context: RouteContext) {
  const requestStart = performance.now();
  const id = await resolveLeadId(context);

  if (!id) {
    // console.log('[DEBUG][lead/:id][GET] Invalid or missing id in route params');
    return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 });
  }
  // console.log('[DEBUG][lead/:id][GET] Request received for id:', id);

  const includeFollowUps = parseIncludeFlag(_request.nextUrl.searchParams.get('includeFollowUps'), true);
  const includeAttachments = parseIncludeFlag(_request.nextUrl.searchParams.get('includeAttachments'), true);
  const includeNotes = parseIncludeFlag(_request.nextUrl.searchParams.get('includeNotes'), true);
  const includeActivities = parseIncludeFlag(_request.nextUrl.searchParams.get('includeActivities'), true);
  const includeStatusHistory = parseIncludeFlag(_request.nextUrl.searchParams.get('includeStatusHistory'), true);
  const includeVisits = parseIncludeFlag(_request.nextUrl.searchParams.get('includeVisits'), true);

  const fetchLead = (loadAttachments: boolean) =>
    prisma.lead.findFirst({
      where: { id },
      include: {
        assignee: {
          select: { id: true, fullName: true, email: true },
        },
        ...(includeFollowUps
          ? {
              followUps: {
                include: {
                  assignedTo: {
                    select: { id: true, fullName: true, email: true },
                  },
                },
                orderBy: { followupDate: 'desc' },
              },
            }
          : {}),
        ...(loadAttachments && includeAttachments
          ? {
              attachments: {
                orderBy: { createdAt: 'desc' as const },
              },
            }
          : {}),
        ...(includeNotes
          ? {
              notes: {
                include: {
                  user: {
                    select: { id: true, fullName: true, email: true },
                  },
                },
                orderBy: { createdAt: 'desc' },
              },
            }
          : {}),
        ...(includeActivities
          ? {
              activities: {
                include: {
                  user: {
                    select: { id: true, fullName: true, email: true },
                  },
                },
                orderBy: { createdAt: 'desc' },
                take: 20,
              },
            }
          : {}),
        ...(includeVisits
          ? {
              visits: {
                select: {
                  id: true,
                  scheduledAt: true,
                  projectSqft: true,
                  projectStatus: true,
                },
                orderBy: { scheduledAt: 'desc' },
                take: 1,
              },
            }
          : {}),
        ...(includeStatusHistory
          ? {
              statusHistory: {
                include: {
                  changedBy: {
                    select: { id: true, fullName: true, email: true },
                  },
                },
                orderBy: { changedAt: 'desc' },
              },
            }
          : {}),
      },
    });

  try {
    const timedDb = await timeAsync(async () => fetchLead(true));
    const lead = timedDb.value;

    if (!lead) {
      // console.log('[DEBUG][lead/:id][GET] Lead not found:', id);
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    // console.log('[DEBUG][lead/:id][GET] Lead fetched successfully:', id);
    const response = NextResponse.json({ success: true, data: lead });
    const totalDurationMs = performance.now() - requestStart;
    response.headers.set(
      'Server-Timing',
      [
        formatServerTiming('db', timedDb.durationMs, 'lead detail query'),
        formatServerTiming('total', totalDurationMs, 'request total'),
      ].join(', '),
    );
    response.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=45');
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      console.warn('[DEBUG][lead/:id][GET] Attachments table missing, retrying without attachments');
      try {
        const timedFallbackDb = await timeAsync(async () => fetchLead(false));
        const lead = timedFallbackDb.value;
        if (!lead) {
          return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
        }

        const response = NextResponse.json({
          success: true,
          data: {
            ...lead,
            attachments: [],
          },
        });
        const totalDurationMs = performance.now() - requestStart;
        response.headers.set(
          'Server-Timing',
          [
            formatServerTiming('db', timedFallbackDb.durationMs, 'fallback detail query'),
            formatServerTiming('total', totalDurationMs, 'request total'),
          ].join(', '),
        );
        response.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=45');
        return response;
      } catch (fallbackError) {
        console.error('[DEBUG][lead/:id][GET] Fallback error:', fallbackError);
        return NextResponse.json({ success: false, error: 'Failed to fetch lead' }, { status: 500 });
      }
    }

    console.error('[DEBUG][lead/:id][GET] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch lead' }, { status: 500 });
  }
}

// PUT /api/lead/[id] - full update with optional status history and activity logging
export async function PUT(request: NextRequest, context: RouteContext) {
  const id = await resolveLeadId(context);

  if (!id) {
    // console.log('[DEBUG][lead/:id][PUT] Invalid or missing id in route params');
    return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 });
  }
  // console.log('[DEBUG][lead/:id][PUT] Request received for id:', id);

  try {
    const body = (await request.json()) as UpdateLeadBody;
    const name = toRequiredString(body.name);
    const phone = toRequiredString(body.phone);
    const email = toOptionalString(body.email)?.toLowerCase();

    // For PUT we enforce required primary fields to avoid partial/ambiguous payloads.
    if (!name || !phone) {
      return NextResponse.json(
        { success: false, error: 'Name and phone are required' },
        { status: 400 }
      );
    }

    const existingLead = await prisma.lead.findFirst({ where: { id } });
    if (!existingLead) {
      // console.log('[DEBUG][lead/:id][PUT] Lead not found:', id);
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    // Prevent duplicate email across different leads (only if email is provided).
    if (email) {
      const duplicate = await prisma.lead.findFirst({
        where: { email, NOT: { id } },
        select: { id: true },
      });

      if (duplicate) {
        // console.log('[DEBUG][lead/:id][PUT] Duplicate email detected:', email);
        return NextResponse.json(
          { success: false, error: 'A lead with this email already exists' },
          { status: 409 }
        );
      }
    }

   
     const stage = toLeadStage(body.stage) ?? existingLead.stage;
    const subStatus = toLeadSubStatus(body.subStatus) ?? null;

    if (!isSubStatusAllowedForStage(stage, subStatus)) {
      return NextResponse.json(
        { success: false, error: 'Invalid subStatus for selected stage' },
        { status: 400 }
      );
    }
    const userId = toOptionalString(body.userId);
    const assignedTo = toOptionalString(body.assignedTo);

    const updated = await prisma.$transaction(async (tx) => {
      const updatedLead = await tx.lead.update({
        where: { id },
        data: {
          name,
          phone,
          email: email ?? existingLead.email,
          source: toOptionalString(body.source),
          stage: stage ?? existingLead.stage,
             
          subStatus,
          budget: toBudget(body.budget) ?? null,
          location: toOptionalString(body.location),
          remarks: toOptionalString(body.remarks),
          assignedTo,
        },
        include: {
          assignee: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });

      // Add status history + activity when valid userId is present.
      if (stage && stage !== existingLead.stage && userId) {
        await tx.leadStatusHistory.create({
          data: {
            leadId: id,
            oldStatus: existingLead.stage,
            newStatus: stage,
            changedById: userId,
          },
        });

             await logLeadStatusChanged(tx, {
          leadId: id,
          userId,
          from: existingLead.stage,
          to: stage,
        });
      }

      if (assignedTo !== existingLead.assignedTo && userId) {
          await logLeadAssignmentChanged(tx, {
          leadId: id,
          userId,
          assignedTo,
        });
      }

      await autoCompletePendingFollowups(tx, {
        leadId: id,
        userId,
        action: 'lead update',
      });

      return updatedLead;
    });

    // console.log('[DEBUG][lead/:id][PUT] Lead updated successfully:', id);
    return NextResponse.json({ success: true, data: updated, message: 'Lead updated successfully' });
  } catch (error) {
    console.error('[DEBUG][lead/:id][PUT] Error:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'A lead with this email already exists' },
          { status: 409 }
        );
      }
      if (error.code === 'P2003') {
        return NextResponse.json(
          { success: false, error: 'Invalid user reference for assignment or activity log' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ success: false, error: 'Failed to update lead' }, { status: 500 });
  }
}

// PATCH /api/lead/[id] - partial update (only applies supplied fields)
export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = await resolveLeadId(context);

  if (!id) {
    // console.log('[DEBUG][lead/:id][PATCH] Invalid or missing id in route params');
    return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 });
  }
  // console.log('[DEBUG][lead/:id][PATCH] Request received for id:', id);

  try {
    const body = (await request.json()) as UpdateLeadBody;

    const existingLead = await prisma.lead.findFirst({ where: { id } });
    if (!existingLead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    const nextEmail =
      body.email !== undefined ? toOptionalString(body.email)?.toLowerCase() ?? null : undefined;

    if (nextEmail && nextEmail !== existingLead.email) {
      const duplicate = await prisma.lead.findFirst({
        where: { email: nextEmail, NOT: { id } },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: 'A lead with this email already exists' },
          { status: 409 }
        );
      }
    }


     const stage = toLeadStage(body.stage);
    const subStatus = toLeadSubStatus(body.subStatus) ?? null;
    const userId = toOptionalString(body.userId);

    const nextStage = stage ?? existingLead.stage;
    const nextSubStatus = body.subStatus !== undefined ? subStatus : existingLead.subStatus;

    if (!isSubStatusAllowedForStage(nextStage, nextSubStatus)) {
      return NextResponse.json(
        { success: false, error: 'Invalid subStatus for selected stage' },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: toRequiredString(body.name) ?? existingLead.name } : {}),
          ...(body.phone !== undefined ? { phone: toOptionalString(body.phone) } : {}),
          ...(nextEmail !== undefined ? { email: nextEmail } : {}),
          ...(body.source !== undefined ? { source: toOptionalString(body.source) } : {}),
           ...(stage !== undefined ? { stage } : {}),
          ...(body.subStatus !== undefined ? { subStatus } : {}),
          ...(body.budget !== undefined ? { budget: toBudget(body.budget) ?? null } : {}),
          ...(body.location !== undefined ? { location: toOptionalString(body.location) } : {}),
          ...(body.remarks !== undefined ? { remarks: toOptionalString(body.remarks) } : {}),
          ...(body.assignedTo !== undefined ? { assignedTo: toOptionalString(body.assignedTo) } : {}),
        },
        include: {
          assignee: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });

      if (stage && stage !== existingLead.stage && userId) {
        await tx.leadStatusHistory.create({
          data: {
            leadId: id,
            oldStatus: existingLead.stage,
            newStatus: stage,
            changedById: userId,
          },
        });

         await logLeadStatusChanged(tx, {
          leadId: id,
          userId,
          from: existingLead.stage,
          to: stage,
        });
      }

      await autoCompletePendingFollowups(tx, {
        leadId: id,
        userId,
        action: 'lead update',
      });

      return lead;
    });

    // console.log('[DEBUG][lead/:id][PATCH] Lead patched successfully:', id);
    return NextResponse.json({ success: true, data: updated, message: 'Lead updated successfully' });
  } catch (error) {
    console.error('[DEBUG][lead/:id][PATCH] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update lead' }, { status: 500 });
  }
}

// DELETE /api/lead/[id] - remove lead (related entities follow DB cascade rules)
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = await resolveLeadId(context);

  if (!id) {
    // console.log('[DEBUG][lead/:id][DELETE] Invalid or missing id in route params');
    return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 });
  }
  // console.log('[DEBUG][lead/:id][DELETE] Request received for id:', id);

  try {
    const existingLead = await prisma.lead.findFirst({ where: { id }, select: { id: true } });
    if (!existingLead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    await prisma.lead.delete({ where: { id } });
    // console.log('[DEBUG][lead/:id][DELETE] Lead deleted successfully:', id);
    return NextResponse.json({ success: true, message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('[DEBUG][lead/:id][DELETE] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete lead' }, { status: 500 });
  }
}
