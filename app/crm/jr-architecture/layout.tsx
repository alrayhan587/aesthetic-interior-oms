import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { MainLayout } from "@/components/layout/mainlayout";

const VISIT_DASHBOARD = "/visit-team/visit-dashboard";
const SR_CRM_DASHBOARD = "/crm/sr/dashboard";
const JR_CRM_DASHBOARD = "/crm/jr/dashboard";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

export default async function JrArchitectureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      userDepartments: {
        select: {
          department: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!user || user.userDepartments.length === 0) {
    redirect("/onboarding");
  }

  const departmentNames = new Set(
    user.userDepartments.map((row) => row.department.name),
  );

  if (departmentNames.has("JR_ARCHITECT")) {
    return <MainLayout role="Jr Architect">{children}</MainLayout>;
  }

  if (departmentNames.has("VISIT_TEAM")) {
    redirect(VISIT_DASHBOARD);
  }

  if (departmentNames.has("SR_CRM")) {
    redirect(SR_CRM_DASHBOARD);
  }

  if (departmentNames.has("JR_CRM")) {
    redirect(JR_CRM_DASHBOARD);
  }

  redirect("/");
}
