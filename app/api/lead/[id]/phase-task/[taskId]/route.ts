import { NextResponse } from 'next/server'

export async function PATCH() {
  return NextResponse.json(
    {
      success: false,
      error: 'Phase deadline update is disabled for Senior CRM lead details.',
    },
    { status: 410 },
  )
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'PATCH, OPTIONS' },
  })
}
