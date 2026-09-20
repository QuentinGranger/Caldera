-- CreateEnum
CREATE TYPE "CheckoutStatus" AS ENUM ('IN_PROGRESS', 'READY_FOR_PAYMENT', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CheckoutAddressRole" AS ENUM ('SHIPPING', 'BILLING');

-- CreateEnum
CREATE TYPE "ShippingMethodType" AS ENUM ('HOME_DELIVERY', 'EXPRESS');

-- CreateTable
CREATE TABLE "CheckoutSession" (
    "id" UUID NOT NULL,
    "cartId" UUID NOT NULL,
    "status" "CheckoutStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "email" TEXT,
    "phone" TEXT,
    "billingSame" BOOLEAN NOT NULL DEFAULT true,
    "shippingMethodId" UUID,
    "shippingAmount" DECIMAL(10,2),
    "readyFingerprint" CHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutAddress" (
    "id" UUID NOT NULL,
    "checkoutId" UUID NOT NULL,
    "role" "CheckoutAddressRole" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "company" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "countryCode" CHAR(2) NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingCountry" (
    "code" CHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ShippingCountry_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "ShippingMethod" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ShippingMethodType" NOT NULL DEFAULT 'HOME_DELIVERY',
    "price" DECIMAL(10,2) NOT NULL,
    "freeFromAmount" DECIMAL(10,2),
    "estimatedMinDays" INTEGER,
    "estimatedMaxDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDevelopment" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ShippingCountryToShippingMethod" (
    "A" CHAR(2) NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ShippingCountryToShippingMethod_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "CheckoutSession_cartId_status_idx" ON "CheckoutSession"("cartId", "status");

-- CreateIndex
CREATE INDEX "CheckoutSession_expiresAt_idx" ON "CheckoutSession"("expiresAt");

-- CreateIndex
CREATE INDEX "CheckoutSession_shippingMethodId_idx" ON "CheckoutSession"("shippingMethodId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutAddress_checkoutId_role_key" ON "CheckoutAddress"("checkoutId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingMethod_code_key" ON "ShippingMethod"("code");

-- CreateIndex
CREATE INDEX "ShippingMethod_isActive_sortOrder_idx" ON "ShippingMethod"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "_ShippingCountryToShippingMethod_B_index" ON "_ShippingCountryToShippingMethod"("B");

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "ShippingMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutAddress" ADD CONSTRAINT "CheckoutAddress_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "CheckoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShippingCountryToShippingMethod" ADD CONSTRAINT "_ShippingCountryToShippingMethod_A_fkey" FOREIGN KEY ("A") REFERENCES "ShippingCountry"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShippingCountryToShippingMethod" ADD CONSTRAINT "_ShippingCountryToShippingMethod_B_fkey" FOREIGN KEY ("B") REFERENCES "ShippingMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShippingMethod" ADD CONSTRAINT "ShippingMethod_amounts_check"
  CHECK ("price" >= 0 AND ("freeFromAmount" IS NULL OR "freeFromAmount" >= 0));
ALTER TABLE "ShippingMethod" ADD CONSTRAINT "ShippingMethod_days_check"
  CHECK (("estimatedMinDays" IS NULL OR "estimatedMinDays" >= 0)
     AND ("estimatedMaxDays" IS NULL OR "estimatedMaxDays" >= 0)
     AND ("estimatedMinDays" IS NULL OR "estimatedMaxDays" IS NULL OR "estimatedMaxDays" >= "estimatedMinDays"));
ALTER TABLE "ShippingCountry" ADD CONSTRAINT "ShippingCountry_code_check" CHECK ("code" ~ '^[A-Z]{2}$');
ALTER TABLE "CheckoutAddress" ADD CONSTRAINT "CheckoutAddress_country_check" CHECK ("countryCode" ~ '^[A-Z]{2}$');
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_shipping_check" CHECK ("shippingAmount" IS NULL OR "shippingAmount" >= 0);
