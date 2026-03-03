import prisma from '@/lib/prisma';
import { LeadStage, LeadStatus, LeadSubStatus, Prisma } from '@/generated/prisma/client';
import { isSubStatusAllowedForStage } from '@/lib/lead-stage';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

type UpdateLeadBody = {
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

function toLeadStatus(value: unknown): LeadStatus | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return LeadStatus.NEW;
  const normalized = value.trim().toUpperCase();
  return Object.values(LeadStatus).includes(normalized as LeadStatus)
    ? (normalized as LeadStatus)
    : LeadStatus.NEW;
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
  const id = await resolveLeadId(context);

  if (!id) {
    console.log('[DEBUG][lead/:id][GET] Invalid or missing id in route params');
    return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 });
  }
  console.log('[DEBUG][lead/:id][GET] Request received for id:', id);

  try {
    const lead = await prisma.lead.findFirst({
      where: { id },
      include: {
        assignee: {
          select: { id: true, fullName: true, email: true },
        },
        followUps: {
          include: {
            assignedTo: {
              select: { id: true, fullName: true, email: true },
            },
          },
          orderBy: { followupDate: 'desc' },
        },
        notes: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        statusHistory: {
          include: {
            changedBy: {
              select: { id: true, fullName: true, email: true },
            },
          },
          orderBy: { changedAt: 'desc' },
        },
      },
    });

    if (!lead) {
      console.log('[DEBUG][lead/:id][GET] Lead not found:', id);
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    console.log('[DEBUG][lead/:id][GET] Lead fetched successfully:', id);
    return NextResponse.json({ success: true, data: lead });
  } catch (error) {
    console.error('[DEBUG][lead/:id][GET] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch lead' }, { status: 500 });
  }
}

// PUT /api/lead/[id] - full update with optional status history and activity logging
export async function PUT(request: NextRequest, context: RouteContext) {
  const id = await resolveLeadId(context);

  if (!id) {
    console.log('[DEBUG][lead/:id][PUT] Invalid or missing id in route params');
    return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 });
  }
  console.log('[DEBUG][lead/:id][PUT] Request received for id:', id);

  try {
    const body = (await request.json()) as UpdateLeadBody;
    const name = toRequiredString(body.name);
    const email = toRequiredString(body.email)?.toLowerCase();

    // For PUT we enforce required primary fields to avoid partial/ambiguous payloads.
    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { status: 400 }
      );
    }

    const existingLead = await prisma.lead.findFirst({ where: { id } });
    if (!existingLead) {
      console.log('[DEBUG][lead/:id][PUT] Lead not found:', id);
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    // Prevent duplicate email across different leads.
    const duplicate = await prisma.lead.findFirst({
      where: { email, NOT: { id } },
      select: { id: true },
    });

    if (duplicate) {
      console.log('[DEBUG][lead/:id][PUT] Duplicate email detected:', email);
      return NextResponse.json(
        { success: false, error: 'A lead with this email already exists' },
        { status: 409 }
      );
    }

    const status = toLeadStatus(body.status);
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
          phone: toOptionalString(body.phone),
          email,
          source: toOptionalString(body.source),
          status: status ?? existingLead.status,
          stage,
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
      if (status && status !== existingLead.status && userId) {
        await tx.leadStatusHistory.create({
          data: {
            leadId: id,
            oldStatus: existingLead.status,
            newStatus: status,
            changedById: userId,
          },
        });

        await tx.activityLog.create({
          data: {
            leadId: id,
            userId,
            type: 'STATUS_CHANGE',
            description: `Status changed from ${existingLead.status} to ${status}`,
          },
        });
      }

      if (assignedTo !== existingLead.assignedTo && userId) {
        await tx.activityLog.create({
          data: {
            leadId: id,
            userId,
            type: 'NOTE',
            description: assignedTo
              ? `Lead assigned to user ${assignedTo}`
              : 'Lead assignment was cleared',
          },
        });
      }

      return updatedLead;
    });

    console.log('[DEBUG][lead/:id][PUT] Lead updated successfully:', id);
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
    console.log('[DEBUG][lead/:id][PATCH] Invalid or missing id in route params');
    return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 });
  }
  console.log('[DEBUG][lead/:id][PATCH] Request received for id:', id);

  try {
    const body = (await request.json()) as UpdateLeadBody;

    const existingLead = await prisma.lead.findFirst({ where: { id } });
    if (!existingLead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    const nextEmail =
      body.email !== undefined ? toOptionalString(body.email)?.toLowerCase() ?? null : undefined;

    if (nextEmail === null) {
      return NextResponse.json(
        { success: false, error: 'Email cannot be empty' },
        { status: 400 }
      );
    }

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

    const status = toLeadStatus(body.status);
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
          ...(status !== undefined ? { status } : {}),
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

      if (status && status !== existingLead.status && userId) {
        await tx.leadStatusHistory.create({
          data: {
            leadId: id,
            oldStatus: existingLead.status,
            newStatus: status,
            changedById: userId,
          },
        });

        await tx.activityLog.create({
          data: {
            leadId: id,
            userId,
            type: 'STATUS_CHANGE',
            description: `Status changed from ${existingLead.status} to ${status}`,
          },
        });
      }

      return lead;
    });

    console.log('[DEBUG][lead/:id][PATCH] Lead patched successfully:', id);
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
    console.log('[DEBUG][lead/:id][DELETE] Invalid or missing id in route params');
    return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400 });
  }
  console.log('[DEBUG][lead/:id][DELETE] Request received for id:', id);

  try {
    const existingLead = await prisma.lead.findFirst({ where: { id }, select: { id: true } });
    if (!existingLead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    await prisma.lead.delete({ where: { id } });
    console.log('[DEBUG][lead/:id][DELETE] Lead deleted successfully:', id);
    return NextResponse.json({ success: true, message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('[DEBUG][lead/:id][DELETE] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete lead' }, { status: 500 });
  }
}