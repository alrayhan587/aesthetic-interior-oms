-- AlterTable
ALTER TABLE "VisitResult"
ADD COLUMN "clientPotentiality" TEXT,
ADD COLUMN "projectType" TEXT,
ADD COLUMN "clientPersonality" TEXT,
ADD COLUMN "budgetRange" TEXT,
ADD COLUMN "timelineUrgency" TEXT,
ADD COLUMN "stylePreference" TEXT;

-- CreateTable
CREATE TABLE "VisitSupportAssignment" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "supportUserId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitSupportAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitSupportResult" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "supportAssignmentId" TEXT NOT NULL,
    "supportUserId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "projectArea" TEXT NOT NULL,
    "projectStatus" TEXT NOT NULL,
    "extraConcern" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitSupportResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportAttachment" (
    "id" TEXT NOT NULL,
    "supportResultId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisitSupportAssignment_visitId_supportUserId_key" ON "VisitSupportAssignment"("visitId", "supportUserId");
CREATE INDEX "VisitSupportAssignment_visitId_idx" ON "VisitSupportAssignment"("visitId");
CREATE INDEX "VisitSupportAssignment_supportUserId_idx" ON "VisitSupportAssignment"("supportUserId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitSupportResult_supportAssignmentId_key" ON "VisitSupportResult"("supportAssignmentId");
CREATE UNIQUE INDEX "VisitSupportResult_visitId_supportUserId_key" ON "VisitSupportResult"("visitId", "supportUserId");
CREATE INDEX "VisitSupportResult_visitId_idx" ON "VisitSupportResult"("visitId");
CREATE INDEX "VisitSupportResult_supportUserId_idx" ON "VisitSupportResult"("supportUserId");

-- CreateIndex
CREATE INDEX "SupportAttachment_supportResultId_idx" ON "SupportAttachment"("supportResultId");

-- AddForeignKey
ALTER TABLE "VisitSupportAssignment" ADD CONSTRAINT "VisitSupportAssignment_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitSupportAssignment" ADD CONSTRAINT "VisitSupportAssignment_supportUserId_fkey" FOREIGN KEY ("supportUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitSupportAssignment" ADD CONSTRAINT "VisitSupportAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitSupportResult" ADD CONSTRAINT "VisitSupportResult_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitSupportResult" ADD CONSTRAINT "VisitSupportResult_supportAssignmentId_fkey" FOREIGN KEY ("supportAssignmentId") REFERENCES "VisitSupportAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitSupportResult" ADD CONSTRAINT "VisitSupportResult_supportUserId_fkey" FOREIGN KEY ("supportUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAttachment" ADD CONSTRAINT "SupportAttachment_supportResultId_fkey" FOREIGN KEY ("supportResultId") REFERENCES "VisitSupportResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
