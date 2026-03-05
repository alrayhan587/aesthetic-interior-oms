-- CreateEnum
CREATE TYPE "LeadAssignmentDepartment" AS ENUM ('SR_CRM', 'JR_CRM', 'QUOTATION', 'VISIT_TEAM', 'JR_ARCHITECT', 'VISUALIZER_3D');

-- CreateTable
CREATE TABLE "LeadAssignment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "department" "LeadAssignmentDepartment" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadAssignment_leadId_idx" ON "LeadAssignment"("leadId");

-- CreateIndex
CREATE INDEX "LeadAssignment_userId_idx" ON "LeadAssignment"("userId");

-- CreateIndex
CREATE INDEX "LeadAssignment_department_idx" ON "LeadAssignment"("department");

-- CreateIndex
CREATE UNIQUE INDEX "LeadAssignment_leadId_department_userId_key" ON "LeadAssignment"("leadId", "department", "userId");

-- AddForeignKey
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
