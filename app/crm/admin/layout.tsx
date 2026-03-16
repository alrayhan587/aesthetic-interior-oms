import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { MainLayout } from "@/components/layout/mainlayout";

const CRM_DASHBOARD = "/crm/jr/dashboard";
const VISIT_DASHBOARD = "/visit-team/visit-dashboard";

export default async function AdminLayout({
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
    include: { userDepartments: { include: { department: true } } },
  });

  if (!user || user.userDepartments.length === 0) {
    redirect("/onboarding");
  }

  const departmentNames = new Set(
    user.userDepartments.map((row) => row.department.name),
  );

  if (departmentNames.has("ADMIN")) {
    return <MainLayout role="Admin">{children}</MainLayout>;
  }

  if (departmentNames.has("JR_CRM")) {
    redirect(CRM_DASHBOARD);
  }

  if (departmentNames.has("VISIT_TEAM")) {
    redirect(VISIT_DASHBOARD);
  }

  redirect("/");
}
