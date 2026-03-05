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
  if (!hasUserId(input.userId)) return;

  await writer.activityLog.create({
    data: {
      leadId: input.leadId,
      userId: input.userId,
      type: input.type,
      description: input.description,
    },
  });
}

export async function logLeadCreated(
  writer: ActivityLogWriter,
  input: BaseLogInput & { leadName: string }
): Promise<void> {
  await logActivity(writer, {
    leadId: input.leadId,
    userId: input.userId,
    type: ActivityType.NOTE,
    description: `Lead "${input.leadName}" was created`,
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