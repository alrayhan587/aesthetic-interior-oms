import prisma from '@/lib/prisma';
import { LeadStage, LeadSubStatus, Prisma, LeadStatus } from '@/generated/prisma/client';
import { isSubStatusAllowedForStage } from '@/lib/lead-stage';
import { NextRequest, NextResponse } from 'next/server';
import { logLeadCreated } from '@/lib/activity-log-service';

// Type definition for the request body when creating a lead
type CreateLeadBody = {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  source?: unknown;
  status?: unknown;
   stage?: unknown;
  subStatus?: unknown;
  budget?: unknown;
  location?: unknown;
  remarks?: unknown;
  assignedTo?: unknown;
  userId?: unknown;
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

// Utility function to convert string to LeadStatus enum
// Returns LeadStatus.NEW as default if value is invalid
function toLeadStatus(value: unknown): LeadStatus {
  if (typeof value !== 'string') return LeadStatus.NEW;
  const normalized = value.trim().toUpperCase();
  return Object.values(LeadStatus).includes(normalized as LeadStatus)
    ? (normalized as LeadStatus)
    : LeadStatus.NEW;
}

function toLeadStage(value: unknown): LeadStage {
  if (typeof value !== 'string') return LeadStage.NEW;
  const normalized = value.trim().toUpperCase();
  return Object.values(LeadStage).includes(normalized as LeadStage)
    ? (normalized as LeadStage)
    : LeadStage.NEW;
}

function toLeadSubStatus(value: unknown): LeadSubStatus | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toUpperCase();
  return Object.values(LeadSubStatus).includes(normalized as LeadSubStatus)
    ? (normalized as LeadSubStatus)
    : null;
}

// GET endpoint - Retrieve all leads from the database
// Returns leads ordered by creation date (newest first)
// Includes assignee information (user who the lead is assigned to)
export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        assignee: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: leads });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}

// POST endpoint - Create a new lead
// Validates required fields (name, email) and checks for duplicate emails
// Uses database transaction to ensure atomicity when creating lead and activity log
export async function POST(request: NextRequest) {
  try {
    // Parse incoming JSON request body
    const body = (await request.json()) as CreateLeadBody;

    // Extract and validate required fields
    const name = toOptionalString(body.name);
    const email = toOptionalString(body.email)?.toLowerCase();

    // Return 400 error if required fields are missing or invalid
    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Check if a lead with the same email already exists to prevent duplicates
    const existingLead = await prisma.lead.findFirst({
      where: { email },
      select: { id: true },
    });

    // Return 409 Conflict if email already exists
    if (existingLead) {
      return NextResponse.json(
        { success: false, error: 'A lead with this email already exists' },
        { status: 409 }
      );
    }

     const stage = toLeadStage(body.stage);
    const subStatus = toLeadSubStatus(body.subStatus);

    if (!isSubStatusAllowedForStage(stage, subStatus)) {
      return NextResponse.json(
        { success: false, error: 'Invalid subStatus for selected stage' },
        { status: 400 }
      );
    }

    // Create lead and activity log in a transaction
    // Transaction ensures both operations succeed or both fail
    const lead = await prisma.$transaction(async (tx) => {
      // Create the new lead with validated data
      const newLead = await tx.lead.create({
        data: {
          name,
          phone: toOptionalString(body.phone),
          email,
          source: toOptionalString(body.source),
          status: toLeadStatus(body.status),
          stage,
          subStatus,
          budget: toBudget(body.budget),
          location: toOptionalString(body.location),
          remarks: toOptionalString(body.remarks),
          assignedTo: toOptionalString(body.assignedTo),
        },
        // Include assignee details in the response
        include: {
          assignee: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });

      // Log the lead creation activity if userId is provided
      const userId = toOptionalString(body.userId);
      if (userId) {
        await logLeadCreated(tx, {
        leadId: newLead.id,
        userId,
        leadName: name,
      });
      }

      return newLead;
    });

    // Return 201 Created with the new lead data
    return NextResponse.json(
      { success: true, data: lead, message: 'Lead created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating lead:', error);

    // Handle specific Prisma unique constraint violation (P2002 error code)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'A lead with this email already exists' },
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