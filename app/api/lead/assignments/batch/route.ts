import { LeadAssignmentDepartment, LeadPrimaryOwnerDepartment } from '@/generated/prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireDatabaseRoles } from '@/lib/authz'
import prisma from '@/lib/prisma'
import { logUserAssigned } from '@/lib/activity-log-service'
import { autoCompletePendingFollowups } from '@/lib/followup-auto-complete'

type BatchAssignBody = {
  leadIds?: unknown
  department?: unknown
  userId?: unknown
}

const ASSIGNABLE_DEPARTMENTS = new Set<string>(Object.values(LeadAssignmentDepartment))

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toLeadIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const leadIds = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
  return Array.from(new Set(leadIds))
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireDatabaseRoles([])
    if (!authResult.ok) {
      return authResult.response
    }

    const actorDepartments = new Set(authResult.actor.userDepartments ?? [])
    if (!actorDepartments.has('ADMIN')) {
      return NextResponse.json(
        { success: false, error: 'Only ADMIN users can run batch assignments' },
        { status: 403 },
      )
    }

    const body = (await request.json()) as BatchAssignBody
    const leadIds = toLeadIds(body.leadIds)
    const department = toOptionalString(body.department)
    const userId = toOptionalString(body.userId)

    if (leadIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'leadIds is required' },
        { status: 400 },
      )
    }

    if (leadIds.length > 200) {
      return NextResponse.json(
        { success: false, error: 'Maximum 200 leads are allowed per batch request' },
        { status: 400 },
      )
    }

    if (!department || !ASSIGNABLE_DEPARTMENTS.has(department)) {
      return NextResponse.json(
        { success: false, error: 'Valid department is required' },
        { status: 400 },
      )
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 },
      )
    }

    const [user, leads] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          userDepartments: {
            select: { department: { select: { name: true } } },
          },
        },
      }),
      prisma.lead.findMany({
        where: { id: { in: leadIds } },
        select: { id: true },
      }),
    ])

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 },
      )
    }

    const userDepartmentNames = new Set(
      (user.userDepartments ?? []).map((item) => item.department.name),
    )
    if (!userDepartmentNames.has(department)) {
      return NextResponse.json(
        { success: false, error: `User is not mapped to ${department} department` },
        { status: 400 },
      )
    }

    const existingLeadIds = new Set(leads.map((lead) => lead.id))
    const missingLeadIds = leadIds.filter((id) => !existingLeadIds.has(id))

    const result = await prisma.$transaction(async (tx) => {
      let created = 0
      let updated = 0

      for (const lead of leads) {
        const existingAssignment = await tx.leadAssignment.findFirst({
          where: {
            leadId: lead.id,
            department: department as LeadAssignmentDepartment,
          },
          select: { id: true, userId: true },
        })

        if (existingAssignment) {
          if (existingAssignment.userId !== user.id) {
            await tx.leadAssignment.update({
              where: { id: existingAssignment.id },
              data: { userId: user.id },
            })
            updated += 1
          }
        } else {
          await tx.leadAssignment.create({
            data: {
              leadId: lead.id,
              userId: user.id,
              department: department as LeadAssignmentDepartment,
            },
          })
          created += 1
        }

        if (department === LeadAssignmentDepartment.SR_CRM) {
          await tx.lead.update({
            where: { id: lead.id },
            data: {
              primaryOwnerDepartment: LeadPrimaryOwnerDepartment.SR_CRM,
              primaryOwnerUserId: user.id,
            },
          })
        }

        await logUserAssigned(tx, {
          leadId: lead.id,
          userId: authResult.actorUserId,
          leadName: `${user.fullName} assigned to ${department} department`,
        })

        await autoCompletePendingFollowups(tx, {
          leadId: lead.id,
          userId: authResult.actorUserId,
          action: 'batch assignment update',
        })
      }

      return {
        processed: leads.length,
        created,
        updated,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        missingLeadIds,
      },
      message: `Batch assignment completed for ${result.processed} leads`,
    })
  } catch (error) {
    console.error('[POST /api/lead/assignments/batch] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to complete batch assignment' },
      { status: 500 },
    )
  }
}
