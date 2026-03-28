import { NextResponse } from 'next/server'
import { requireDatabaseRoles } from '@/lib/authz'
import { isFacebookConfigured, syncRecentFacebookConversationsToLeads } from '@/lib/facebook'

export async function POST() {
  const authResult = await requireDatabaseRoles([])
  if (!authResult.ok) {
    return authResult.response
  }

  if (!isFacebookConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Facebook Graph API is not configured' },
      { status: 400 },
    )
  }

  try {
    const result = await syncRecentFacebookConversationsToLeads({ limit: 20 })
    return NextResponse.json({
      success: true,
      data: result,
      message: 'Facebook conversations synced to leads',
    })
  } catch (error) {
    console.error('[POST /api/facebook/sync] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to sync Facebook conversations' },
      { status: 500 },
    )
  }
}
