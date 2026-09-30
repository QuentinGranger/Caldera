-- CreateEnum
CREATE TYPE "TaxMode" AS ENUM ('NONE', 'LOCAL', 'STRIPE_TAX');

-- AlterTable
ALTER TABLE "InvoiceSettings" ADD COLUMN     "franchiseMajoredThreshold" DECIMAL(12,2) NOT NULL DEFAULT 93500,
ADD COLUMN     "franchiseThreshold" DECIMAL(12,2) NOT NULL DEFAULT 85000,
ADD COLUMN     "productTaxCode" TEXT NOT NULL DEFAULT 'txcd_99999999',
ADD COLUMN     "shippingTaxCode" TEXT NOT NULL DEFAULT 'txcd_92010001',
ADD COLUMN     "stripeTaxEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingTaxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "shippingTaxRate" DECIMAL(5,2),
ADD COLUMN     "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxCalculationId" TEXT,
ADD COLUMN     "taxMode" "TaxMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "taxTransactionId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxRate" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "taxReversalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_taxTransactionId_key" ON "Order"("taxTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_taxReversalId_key" ON "Refund"("taxReversalId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_tax_check" CHECK (
  "taxAmount" >= 0 AND "taxAmount" <= "totalAmount" AND "shippingTaxAmount" >= 0
);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_tax_check" CHECK ("taxAmount" >= 0);
ALTER TABLE "InvoiceSettings" ADD CONSTRAINT "InvoiceSettings_tax_check" CHECK (
  "defaultVatRate" BETWEEN 0 AND 30 AND
  "franchiseThreshold" > 0 AND "franchiseMajoredThreshold" >= "franchiseThreshold" AND
  (NOT "stripeTaxEnabled" OR "vatRegime" = 'STANDARD')
);
