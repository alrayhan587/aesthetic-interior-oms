import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

console.log('[DEBUG] DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('[DEBUG] DATABASE_URL value:', process.env.DATABASE_URL ? '***hidden***' : 'undefined');

export async function GET() {
  console.log('[DEBUG] GET /api/lead called');
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { created_at: 'desc' },
    });
    console.log('[DEBUG] Found leads:', leads.length);
    return NextResponse.json(leads);
  } catch (error) {
    console.error('[DEBUG] GET error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { name, email, phone, status, assignedTo } = await req.json();

  if (!name || !email) {
    return NextResponse.json({ error: 'name and email required' }, { status: 400 });
  }
  console.log('[DEBUG] POST /api/lead called with:', { name, email, phone, status, assignedTo });

  const lead = await prisma.lead.create({
    data: { name, email, phone, status: status ?? 'new', assignedTo: assignedTo ?? null },
  });

  return NextResponse.json(lead, { status: 201 });
}
