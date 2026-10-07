-- CreateEnum
CREATE TYPE "DiscordPublicationStatus" AS ENUM ('DRAFT', 'PENDING', 'PROCESSING', 'SENT', 'RETRY', 'REVIEW', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "DiscordOutbox" (
    "id" UUID NOT NULL,
    "eventKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "productId" UUID,
    "status" "DiscordPublicationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "messageId" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscordOutbox_eventKey_key" ON "DiscordOutbox"("eventKey");

-- CreateIndex
CREATE INDEX "DiscordOutbox_status_nextAttemptAt_idx" ON "DiscordOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "DiscordOutbox_productId_idx" ON "DiscordOutbox"("productId");

