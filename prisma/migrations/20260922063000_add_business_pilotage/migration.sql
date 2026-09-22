-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "unitCost" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "BusinessPilotageSettings" (
    "id" TEXT NOT NULL DEFAULT 'caldera',
    "revenueTarget" DECIMAL(12,2) NOT NULL DEFAULT 10000,
    "minimumMarginRate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "maxStockBudget" DECIMAL(12,2) NOT NULL DEFAULT 1000,
    "cashBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "trackingStartDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessPilotageSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessPilotageLaunchProduct" (
    "id" UUID NOT NULL,
    "settingsId" TEXT NOT NULL,
    "productId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessPilotageLaunchProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPilotageLaunchProduct_settingsId_productId_key"
ON "BusinessPilotageLaunchProduct"("settingsId", "productId");

-- CreateIndex
CREATE INDEX "BusinessPilotageLaunchProduct_productId_idx"
ON "BusinessPilotageLaunchProduct"("productId");

-- AddForeignKey
ALTER TABLE "BusinessPilotageLaunchProduct"
ADD CONSTRAINT "BusinessPilotageLaunchProduct_settingsId_fkey"
FOREIGN KEY ("settingsId") REFERENCES "BusinessPilotageSettings"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPilotageLaunchProduct"
ADD CONSTRAINT "BusinessPilotageLaunchProduct_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
