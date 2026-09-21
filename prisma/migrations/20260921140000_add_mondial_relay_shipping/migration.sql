-- CreateEnum
CREATE TYPE "PickupPointType" AS ENUM ('RELAY_POINT', 'LOCKER', 'UNKNOWN');

-- AlterEnum
ALTER TYPE "ShippingMethodType" ADD VALUE 'PICKUP';

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "lastTrackedAt" TIMESTAMP(3),
ADD COLUMN "providerLabelUrl" TEXT,
ADD COLUMN "providerShipmentId" TEXT,
ADD COLUMN "providerStatus" TEXT,
ADD COLUMN "weightGrams" INTEGER;

-- CreateTable
CREATE TABLE "CheckoutPickupPoint" (
    "id" UUID NOT NULL,
    "checkoutId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "type" "PickupPointType" NOT NULL DEFAULT 'UNKNOWN',
    "name" TEXT NOT NULL,
    "address1" TEXT NOT NULL,
    "address2" TEXT,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "distanceM" INTEGER,
    "openingHours" JSONB,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CheckoutPickupPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderPickupPoint" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "type" "PickupPointType" NOT NULL DEFAULT 'UNKNOWN',
    "name" TEXT NOT NULL,
    "address1" TEXT NOT NULL,
    "address2" TEXT,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "distanceM" INTEGER,
    "openingHours" JSONB,
    "selectedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderPickupPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "providerKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "location" TEXT,
    "occurredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CheckoutPickupPoint_checkoutId_key" ON "CheckoutPickupPoint"("checkoutId");
CREATE INDEX "CheckoutPickupPoint_provider_pointId_idx" ON "CheckoutPickupPoint"("provider", "pointId");
CREATE UNIQUE INDEX "OrderPickupPoint_orderId_key" ON "OrderPickupPoint"("orderId");
CREATE INDEX "OrderPickupPoint_provider_pointId_idx" ON "OrderPickupPoint"("provider", "pointId");
CREATE INDEX "TrackingEvent_shipmentId_occurredAt_idx" ON "TrackingEvent"("shipmentId", "occurredAt");
CREATE UNIQUE INDEX "TrackingEvent_shipmentId_providerKey_key" ON "TrackingEvent"("shipmentId", "providerKey");
CREATE UNIQUE INDEX "Shipment_providerShipmentId_key" ON "Shipment"("providerShipmentId");
CREATE UNIQUE INDEX "Shipment_idempotencyKey_key" ON "Shipment"("idempotencyKey");

ALTER TABLE "CheckoutPickupPoint" ADD CONSTRAINT "CheckoutPickupPoint_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "CheckoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderPickupPoint" ADD CONSTRAINT "OrderPickupPoint_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
