-- CreateEnum
CREATE TYPE "StockAlertStatus" AS ENUM ('PENDING', 'ACTIVE', 'SENDING', 'NOTIFIED', 'FAILED');

-- CreateTable
CREATE TABLE "StockAlert" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "variantId" UUID NOT NULL,
    "customerId" UUID,
    "status" "StockAlertStatus" NOT NULL DEFAULT 'PENDING',
    "confirmationTokenHash" CHAR(64),
    "confirmationExpiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "providerMessageId" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockAlert_confirmationTokenHash_key" ON "StockAlert"("confirmationTokenHash");

-- CreateIndex
CREATE INDEX "StockAlert_variantId_status_idx" ON "StockAlert"("variantId", "status");

-- CreateIndex
CREATE INDEX "StockAlert_status_nextAttemptAt_idx" ON "StockAlert"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "StockAlert_customerId_idx" ON "StockAlert"("customerId");

-- CreateIndex
CREATE INDEX "StockAlert_confirmationExpiresAt_idx" ON "StockAlert"("confirmationExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockAlert_email_variantId_key" ON "StockAlert"("email", "variantId");

-- AddForeignKey
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
