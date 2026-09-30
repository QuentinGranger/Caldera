-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "RefundReason" AS ENUM ('CUSTOMER_REQUEST', 'RETURN_RECEIVED', 'DAMAGED', 'MISSING_ITEM', 'OUT_OF_STOCK', 'DUPLICATE', 'FRAUD', 'OTHER');

-- AlterEnum
ALTER TYPE "EmailType" ADD VALUE 'ORDER_REFUNDED';

-- CreateTable
CREATE TABLE "Refund" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "shippingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "reason" "RefundReason" NOT NULL,
    "note" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "providerRefundId" TEXT,
    "failureReason" TEXT,
    "restock" BOOLEAN NOT NULL DEFAULT false,
    "restockedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "succeededAt" TIMESTAMP(3),
    "createdById" UUID,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundItem" (
    "id" UUID NOT NULL,
    "refundId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "RefundItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Refund_providerRefundId_key" ON "Refund"("providerRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Refund_orderId_createdAt_idx" ON "Refund"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "Refund_status_updatedAt_idx" ON "Refund"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");

-- CreateIndex
CREATE INDEX "Refund_createdById_idx" ON "Refund"("createdById");

-- CreateIndex
CREATE INDEX "RefundItem_orderItemId_idx" ON "RefundItem"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "RefundItem_refundId_orderItemId_key" ON "RefundItem"("refundId", "orderItemId");

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundItem" ADD CONSTRAINT "RefundItem_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundItem" ADD CONSTRAINT "RefundItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One e-mail per event instead of one per (order, type): refunds may send
-- several. Existing rows keep their former key, and the new unique index
-- exists before the old one is dropped, so duplicates are never possible.
ALTER TABLE "EmailDelivery" ADD COLUMN "dedupeKey" TEXT;
UPDATE "EmailDelivery" SET "dedupeKey" = "orderId"::text || ':' || "type"::text;
ALTER TABLE "EmailDelivery" ALTER COLUMN "dedupeKey" SET NOT NULL;
CREATE UNIQUE INDEX "EmailDelivery_dedupeKey_key" ON "EmailDelivery"("dedupeKey");
CREATE INDEX "EmailDelivery_orderId_type_idx" ON "EmailDelivery"("orderId", "type");
DROP INDEX "EmailDelivery_orderId_type_key";

-- Between this migration and the deployment of the matching code, the code
-- still running inserts e-mails without "dedupeKey": the key it would have
-- used is filled in, so no payment confirmation fails in that window. The
-- current code always sets the key; this trigger then never acts.
CREATE FUNCTION "EmailDelivery_default_dedupe_key"() RETURNS trigger AS $$
BEGIN
  IF NEW."dedupeKey" IS NULL THEN
    NEW."dedupeKey" := NEW."orderId"::text || ':' || NEW."type"::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "EmailDelivery_default_dedupe_key"
BEFORE INSERT ON "EmailDelivery"
FOR EACH ROW EXECUTE FUNCTION "EmailDelivery_default_dedupe_key"();
