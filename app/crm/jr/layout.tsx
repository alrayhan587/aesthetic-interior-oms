import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { MainLayout } from "@/components/layout/mainlayout";

const VISIT_DASHBOARD = "/visit-team/visit-dashboard";

export default async function CRMLayout({
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

  if (departmentNames.has("JR_CRM")) {
    return <MainLayout role="JR CRM">{children}</MainLayout>;
  }

  if (departmentNames.has("VISIT_TEAM")) {
    redirect(VISIT_DASHBOARD);
  }

  redirect("/");
}
