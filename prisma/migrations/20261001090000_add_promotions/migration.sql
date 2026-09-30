-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING');

-- CreateEnum
CREATE TYPE "PromotionRedemptionStatus" AS ENUM ('RESERVED', 'CONSUMED', 'RELEASED');

-- AlterTable
ALTER TABLE "CheckoutSession" ADD COLUMN     "promotionId" UUID;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "promotionCode" TEXT,
ADD COLUMN     "promotionLabel" TEXT,
ADD COLUMN     "shippingDiscountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Promotion" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL,
    "percentOff" INTEGER,
    "amountOff" DECIMAL(10,2),
    "minimumSubtotal" DECIMAL(10,2),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "maxPerCustomer" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "gameId" UUID,
    "categoryId" UUID,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionRedemption" (
    "id" UUID NOT NULL,
    "promotionId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "status" "PromotionRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
    "discountAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- CreateIndex
CREATE INDEX "Promotion_isActive_endsAt_idx" ON "Promotion"("isActive", "endsAt");

-- CreateIndex
CREATE INDEX "Promotion_gameId_idx" ON "Promotion"("gameId");

-- CreateIndex
CREATE INDEX "Promotion_categoryId_idx" ON "Promotion"("categoryId");

-- CreateIndex
CREATE INDEX "Promotion_createdById_idx" ON "Promotion"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionRedemption_orderId_key" ON "PromotionRedemption"("orderId");

-- CreateIndex
CREATE INDEX "PromotionRedemption_promotionId_status_idx" ON "PromotionRedemption"("promotionId", "status");

-- CreateIndex
CREATE INDEX "PromotionRedemption_promotionId_email_idx" ON "PromotionRedemption"("promotionId", "email");

-- CreateIndex
CREATE INDEX "CheckoutSession_promotionId_idx" ON "CheckoutSession"("promotionId");

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Money invariants the application relies on. The order total now takes the
-- promotional discount off (shippingAmount is already net of a free-shipping code).
ALTER TABLE "Order" DROP CONSTRAINT "Order_totals_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_totals_check" CHECK (
  "subtotalAmount" >= 0 AND "shippingAmount" >= 0 AND
  "discountAmount" >= 0 AND "discountAmount" <= "subtotalAmount" AND
  "shippingDiscountAmount" >= 0 AND
  "totalAmount" = "subtotalAmount" - "discountAmount" + "shippingAmount"
);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_discount_check"
  CHECK ("discountAmount" >= 0 AND "discountAmount" <= "lineTotal");
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_value_check" CHECK (
  ("type" = 'PERCENTAGE' AND "percentOff" BETWEEN 1 AND 90 AND "amountOff" IS NULL) OR
  ("type" = 'FIXED_AMOUNT' AND "amountOff" > 0 AND "percentOff" IS NULL) OR
  ("type" = 'FREE_SHIPPING' AND "percentOff" IS NULL AND "amountOff" IS NULL)
);
