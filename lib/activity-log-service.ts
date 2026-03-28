import { ActivityType, Prisma } from '@/generated/prisma/client';

type ActivityLogWriter = {
  activityLog: {
    create: (args: Prisma.ActivityLogCreateArgs) => Promise<unknown>;
  };
};

type BaseLogInput = {
  leadId: string;
  userId?: string | null;
};

function hasUserId(userId?: string | null): userId is string {
  return typeof userId === 'string' && userId.trim().length > 0;
}

export async function logActivity(
  writer: ActivityLogWriter,
  input: BaseLogInput & { type: ActivityType; description: string }
): Promise<void> {
  if (!hasUserId(input.userId)) {
    // console.log('📝 [logActivity] - Skipping: no userId');
    return;
  }

  await writer.activityLog.create({
    data: {
      leadId: input.leadId,
      userId: input.userId,
      type: input.type,
      description: input.description,
    },
  });
  // console.log('✅ [logActivity] - Activity log created successfully');
}

export async function logLeadCreated(
  writer: ActivityLogWriter,
  input: BaseLogInput & { leadName: string }
): Promise<void> {
  await logActivity(writer, {
    leadId: input.leadId,
    userId: input.userId,
    type: ActivityType.LEAD_CREATED,
    description: `Lead "${input.leadName}" was created`,
  });
}


export async function logUserAssigned(
  writer: ActivityLogWriter,
  input: BaseLogInput & { leadName: string }
): Promise<void> {
  // console.log('🔗 [logUserAssigned] - Logging user assignment');
  await logActivity(writer, {
    leadId: input.leadId,
    userId: input.userId,
    type: ActivityType.USER_ASSIGNED,
    description: `${input.leadName} was assigned`,
  });
}


export async function logLeadStatusChanged(
  writer: ActivityLogWriter,
  input: BaseLogInput & { from: string; to: string }
): Promise<void> {
  await logActivity(writer, {
    leadId: input.leadId,
    userId: input.userId,
    type: ActivityType.STATUS_CHANGE,
    description: `Status changed from ${input.from} to ${input.to}`,
  });
}

export async function logLeadStageChanged(
  writer: ActivityLogWriter,
  input: BaseLogInput & { from: string; to: string; reason?: string | null }
): Promise<void> {
  const reasonPart = input.reason ? ` (Reason: ${input.reason})` : '';
  await logActivity(writer, {
    leadId: input.leadId,
    userId: input.userId,
    type: ActivityType.STATUS_CHANGE,
    description: `Stage changed from ${input.from} to ${input.to}${reasonPart}`,
  });
}

export async function logLeadSubStatusChanged(
  writer: ActivityLogWriter,
  input: BaseLogInput & { from: string | null; to: string | null; reason?: string | null }
): Promise<void> {
  const fromValue = input.from ?? 'NONE';
  const toValue = input.to ?? 'NONE';
  const reasonPart = input.reason ? ` (Reason: ${input.reason})` : '';
  await logActivity(writer, {
    leadId: input.leadId,
    userId: input.userId,
    type: ActivityType.STATUS_CHANGE,
    description: `SubStatus changed from ${fromValue} to ${toValue}${reasonPart}`,
  });
}

export async function logLeadAssignmentChanged(
  writer: ActivityLogWriter,
  input: BaseLogInput & { assignedTo: string | null }
): Promise<void> {
  await logActivity(writer, {
    leadId: input.leadId,
    userId: input.userId,
    type: ActivityType.NOTE,
    description: input.assignedTo
      ? `Lead assigned to user ${input.assignedTo}`
      : 'Lead assignment was cleared',
  });
}
