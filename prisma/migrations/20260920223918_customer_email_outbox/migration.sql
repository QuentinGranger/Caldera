-- CreateEnum
CREATE TYPE "CustomerEmailType" AS ENUM ('EMAIL_VERIFICATION', 'EMAIL_CHANGE', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "CustomerEmailDelivery" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "type" "CustomerEmailType" NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'resend',
    "providerMessageId" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" UUID,
    "retryBlocked" BOOLEAN NOT NULL DEFAULT false,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerEmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerEmailDelivery_status_nextAttemptAt_idx" ON "CustomerEmailDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "CustomerEmailDelivery_leaseUntil_idx" ON "CustomerEmailDelivery"("leaseUntil");

-- CreateIndex
CREATE INDEX "CustomerEmailDelivery_customerId_type_idx" ON "CustomerEmailDelivery"("customerId", "type");

-- AddForeignKey
ALTER TABLE "CustomerEmailDelivery" ADD CONSTRAINT "CustomerEmailDelivery_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
