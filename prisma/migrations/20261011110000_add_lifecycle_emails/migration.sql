-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "customerId" UUID;

-- AlterTable
ALTER TABLE "NewsletterSubscriber" ADD COLUMN     "personalizedConsentAt" TIMESTAMP(3),
ADD COLUMN     "personalizedConsentVersion" TEXT,
ADD COLUMN     "personalizedEmails" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LifecycleDelivery" (
    "id" UUID NOT NULL,
    "subscriberId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "sourceId" TEXT,
    "variantIds" TEXT[],
    "quantities" INTEGER[],
    "status" "NewsletterDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "envelope" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "firstAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" UUID,
    "leaseUntil" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LifecycleDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifecycleVariantState" (
    "variantId" UUID NOT NULL,
    "stock" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "cycle" INTEGER NOT NULL DEFAULT 0,
    "restockedAt" TIMESTAMP(3),
    "priceChangedAt" TIMESTAMP(3),
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LifecycleVariantState_pkey" PRIMARY KEY ("variantId")
);

-- CreateTable
CREATE TABLE "LifecycleRuntime" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subscriberCursor" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" UUID,

    CONSTRAINT "LifecycleRuntime_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LifecycleDelivery_status_nextAttemptAt_idx" ON "LifecycleDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "LifecycleDelivery_subscriberId_firstAttemptAt_idx" ON "LifecycleDelivery"("subscriberId", "firstAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "LifecycleDelivery_subscriberId_eventKey_key" ON "LifecycleDelivery"("subscriberId", "eventKey");

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleDelivery" ADD CONSTRAINT "LifecycleDelivery_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "NewsletterSubscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;


INSERT INTO "LifecycleRuntime" (id, "startedAt") VALUES ('default', CURRENT_TIMESTAMP);

CREATE INDEX "Cart_customerId_idx" ON "Cart"("customerId");
