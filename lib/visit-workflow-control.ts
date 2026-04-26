import 'server-only'

import prisma from '@/lib/prisma'

const SETTINGS_ROW_ID = 'default'

type ControlRow = {
  supportDataEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

export type VisitWorkflowControlState = {
  supportDataEnabled: boolean
  createdAt: string
  updatedAt: string
}

function serialize(row: ControlRow): VisitWorkflowControlState {
  return {
    supportDataEnabled: row.supportDataEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function ensureVisitWorkflowControlRow() {
  return prisma.visitWorkflowControl.upsert({
    where: { id: SETTINGS_ROW_ID },
    create: { id: SETTINGS_ROW_ID, supportDataEnabled: true },
    update: {},
  })
}

export async function getVisitWorkflowControlState(): Promise<VisitWorkflowControlState> {
  const row = await ensureVisitWorkflowControlRow()
  return serialize(row)
}

export async function setVisitSupportDataEnabled(
  supportDataEnabled: boolean,
): Promise<VisitWorkflowControlState> {
  await ensureVisitWorkflowControlRow()
  const row = await prisma.visitWorkflowControl.update({
    where: { id: SETTINGS_ROW_ID },
    data: { supportDataEnabled },
  })
  return serialize(row)
}
