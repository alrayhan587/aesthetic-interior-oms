import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireDatabaseRoles } from '@/lib/authz';
import { VisitStatus } from '@/generated/prisma/client';

function toOptionalString(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toVisitStatus(value: string | null): VisitStatus | null {
  if (!value) return null;
  return Object.values(VisitStatus).includes(value as VisitStatus)
    ? (value as VisitStatus)
    : null;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireDatabaseRoles([]);
    if (!authResult.ok) {
      return authResult.response;
    }

    const leadId = toOptionalString(request.nextUrl.searchParams.get('leadId'));
    const assignedToId = toOptionalString(request.nextUrl.searchParams.get('assignedToId'));
    const statusParam = toOptionalString(request.nextUrl.searchParams.get('status'));
    const status = toVisitStatus(statusParam);

    if (statusParam && !status) {
      return NextResponse.json({ success: false, error: 'Invalid visit status filter' }, { status: 400 });
    }

    const visits = await prisma.visit.findMany({
      where: {
        ...(leadId ? { leadId } : {}),
        ...(assignedToId ? { assignedToId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        lead: { select: { id: true, name: true, phone: true, location: true } },
        assignedTo: { select: { id: true, fullName: true, email: true, phone: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: visits });
  } catch (error) {
    console.error('[visit-schedule][GET] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch visit schedules' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'GET, OPTIONS',
    },
  });
}
