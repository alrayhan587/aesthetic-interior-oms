-- CreateTable
CREATE TABLE "WhatsAppWebhookEvent" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT,
    "processedMessages" INTEGER NOT NULL DEFAULT 0,
    "createdLeads" INTEGER NOT NULL DEFAULT 0,
    "skippedExistingPhone" INTEGER NOT NULL DEFAULT 0,
    "skippedNoPhone" INTEGER NOT NULL DEFAULT 0,
    "skippedDuplicateMessage" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_createdAt_idx" ON "WhatsAppWebhookEvent"("createdAt");
