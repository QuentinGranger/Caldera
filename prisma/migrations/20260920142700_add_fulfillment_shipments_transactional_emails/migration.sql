-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('UNFULFILLED', 'PREPARING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('DRAFT', 'SHIPPED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('ORDER_CONFIRMATION', 'ORDER_SHIPPED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'UNFULFILLED',
ADD COLUMN     "preparationStartedAt" TIMESTAMP(3),
ADD COLUMN     "readyToShipAt" TIMESTAMP(3),
ADD COLUMN     "shippedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'DRAFT',
    "carrierCode" TEXT NOT NULL,
    "carrierName" TEXT NOT NULL,
    "hasTracking" BOOLEAN NOT NULL DEFAULT true,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDelivery" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "type" "EmailType" NOT NULL,
    "recipient" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'resend',
    "providerMessageId" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "snapshot" JSONB NOT NULL,
    "envelope" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "firstAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" UUID,
    "retryBlocked" BOOLEAN NOT NULL DEFAULT false,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shipment_orderId_idx" ON "Shipment"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX "Shipment_trackingNumber_idx" ON "Shipment"("trackingNumber");

-- CreateIndex
CREATE INDEX "EmailDelivery_status_nextAttemptAt_idx" ON "EmailDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_leaseUntil_idx" ON "EmailDelivery"("leaseUntil");

-- CreateIndex
CREATE INDEX "EmailDelivery_type_idx" ON "EmailDelivery"("type");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDelivery_orderId_type_key" ON "EmailDelivery"("orderId", "type");

-- CreateIndex
CREATE INDEX "Order_fulfillmentStatus_paidAt_idx" ON "Order"("fulfillmentStatus", "paidAt");

-- CreateIndex
CREATE INDEX "Order_shippedAt_idx" ON "Order"("shippedAt");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Shipment_one_primary" ON "Shipment" ("orderId") WHERE "isPrimary" = true;
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_attempts_check" CHECK ("attemptCount" >= 0);
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_dates_check" CHECK (
  (status = 'DRAFT' AND "shippedAt" IS NULL AND "deliveredAt" IS NULL) OR
  (status = 'SHIPPED' AND "shippedAt" IS NOT NULL AND "deliveredAt" IS NULL) OR
  (status = 'DELIVERED' AND "shippedAt" IS NOT NULL AND "deliveredAt" IS NOT NULL)
);
