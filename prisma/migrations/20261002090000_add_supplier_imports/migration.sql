-- CreateEnum
CREATE TYPE "SupplierImportStatus" AS ENUM ('UPLOADING', 'EXTRACTING', 'MAPPING', 'REVIEW', 'APPLIED', 'REVERTED', 'CANCELED', 'FAILED');

-- CreateEnum
CREATE TYPE "SupplierFileKind" AS ENUM ('CSV', 'XLSX', 'XLS', 'PDF', 'JSON');

-- CreateEnum
CREATE TYPE "SupplierImportScope" AS ENUM ('FULL', 'PARTIAL');

-- CreateEnum
CREATE TYPE "SupplierPageMethod" AS ENUM ('TEXT', 'OCR', 'AI');

-- CreateEnum
CREATE TYPE "SupplierPageStatus" AS ENUM ('PENDING', 'DONE', 'NEEDS_REVIEW', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "SupplierMatch" AS ENUM ('CERTAIN', 'PROBABLE', 'NEW', 'AMBIGUOUS', 'INVALID');

-- CreateEnum
CREATE TYPE "SupplierRowAction" AS ENUM ('CREATE_PRODUCT', 'CREATE_OFFER', 'UPDATE_OFFER', 'UNCHANGED', 'REVIEW', 'REJECT', 'IGNORE');

-- CreateEnum
CREATE TYPE "SupplierAvailability" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK', 'PREORDER', 'ON_ORDER', 'DISCONTINUED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SupplierOfferStatus" AS ENUM ('ACTIVE', 'MISSING');

-- CreateEnum
CREATE TYPE "SupplierChangeKind" AS ENUM ('NEW_OFFER', 'PRICE_DOWN', 'PRICE_UP', 'BACK_IN_STOCK', 'OUT_OF_STOCK', 'STOCK', 'DISAPPEARED', 'REAPPEARED', 'RELEASE_DATE', 'PACKAGING', 'INFO');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "sourceImportId" UUID;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "email" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProfile" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "fileKind" "SupplierFileKind" NOT NULL,
    "signature" CHAR(64) NOT NULL,
    "mapping" JSONB NOT NULL,
    "options" JSONB NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierImport" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "profileId" UUID,
    "status" "SupplierImportStatus" NOT NULL DEFAULT 'UPLOADING',
    "fileName" TEXT NOT NULL,
    "fileKind" "SupplierFileKind" NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileHash" CHAR(64) NOT NULL,
    "scope" "SupplierImportScope" NOT NULL DEFAULT 'FULL',
    "headers" JSONB,
    "extraction" JSONB,
    "mapping" JSONB,
    "options" JSONB,
    "summary" JSONB,
    "error" TEXT,
    "createdById" UUID NOT NULL,
    "appliedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "extractedAt" TIMESTAMP(3),
    "analyzedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "revertedAt" TIMESTAMP(3),
    "durationMs" INTEGER,

    CONSTRAINT "SupplierImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierImportChunk" (
    "importId" UUID NOT NULL,
    "index" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "SupplierImportChunk_pkey" PRIMARY KEY ("importId","index")
);

-- CreateTable
CREATE TABLE "SupplierImportPage" (
    "importId" UUID NOT NULL,
    "page" INTEGER NOT NULL,
    "method" "SupplierPageMethod" NOT NULL,
    "status" "SupplierPageStatus" NOT NULL DEFAULT 'PENDING',
    "confidence" DOUBLE PRECISION,
    "words" JSONB,
    "rows" JSONB,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierImportPage_pkey" PRIMARY KEY ("importId","page")
);

-- CreateTable
CREATE TABLE "SupplierImportRow" (
    "id" UUID NOT NULL,
    "importId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "source" TEXT,
    "raw" JSONB NOT NULL,
    "values" JSONB,
    "issues" JSONB NOT NULL DEFAULT '[]',
    "match" "SupplierMatch",
    "variantId" UUID,
    "candidates" JSONB,
    "offerId" UUID,
    "action" "SupplierRowAction",
    "decidedAt" TIMESTAMP(3),
    "changes" JSONB,
    "before" JSONB,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "SupplierImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierOffer" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "supplierSku" TEXT NOT NULL,
    "ean" TEXT,
    "variantId" UUID,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "game" TEXT,
    "series" TEXT,
    "category" TEXT,
    "language" "ProductLanguage",
    "condition" TEXT,
    "purchasePrice" DECIMAL(10,2),
    "purchasePriceInclTax" DECIMAL(10,2),
    "msrp" DECIMAL(10,2),
    "vatRate" DECIMAL(5,2),
    "stock" INTEGER,
    "availability" "SupplierAvailability" NOT NULL DEFAULT 'UNKNOWN',
    "releaseDate" DATE,
    "restockDate" DATE,
    "minOrderQty" INTEGER,
    "packaging" TEXT,
    "packSize" INTEGER,
    "description" TEXT,
    "imageUrl" TEXT,
    "productUrl" TEXT,
    "status" "SupplierOfferStatus" NOT NULL DEFAULT 'ACTIVE',
    "missingSince" TIMESTAMP(3),
    "lastImportId" UUID,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierOfferChange" (
    "id" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "importId" UUID NOT NULL,
    "kind" "SupplierChangeKind" NOT NULL,
    "field" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierOfferChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE INDEX "SupplierProfile_signature_idx" ON "SupplierProfile"("signature");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProfile_supplierId_signature_key" ON "SupplierProfile"("supplierId", "signature");

-- CreateIndex
CREATE INDEX "SupplierImport_supplierId_createdAt_idx" ON "SupplierImport"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierImport_status_updatedAt_idx" ON "SupplierImport"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "SupplierImport_createdById_idx" ON "SupplierImport"("createdById");

-- CreateIndex
CREATE INDEX "SupplierImport_appliedById_idx" ON "SupplierImport"("appliedById");

-- CreateIndex
CREATE INDEX "SupplierImport_profileId_idx" ON "SupplierImport"("profileId");

-- CreateIndex
CREATE INDEX "SupplierImportRow_importId_action_idx" ON "SupplierImportRow"("importId", "action");

-- CreateIndex
CREATE INDEX "SupplierImportRow_variantId_idx" ON "SupplierImportRow"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierImportRow_importId_rowNumber_key" ON "SupplierImportRow"("importId", "rowNumber");

-- CreateIndex
CREATE INDEX "SupplierOffer_ean_idx" ON "SupplierOffer"("ean");

-- CreateIndex
CREATE INDEX "SupplierOffer_variantId_idx" ON "SupplierOffer"("variantId");

-- CreateIndex
CREATE INDEX "SupplierOffer_lastImportId_idx" ON "SupplierOffer"("lastImportId");

-- CreateIndex
CREATE INDEX "SupplierOffer_supplierId_status_idx" ON "SupplierOffer"("supplierId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierOffer_supplierId_supplierSku_key" ON "SupplierOffer"("supplierId", "supplierSku");

-- CreateIndex
CREATE INDEX "SupplierOfferChange_offerId_createdAt_idx" ON "SupplierOfferChange"("offerId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierOfferChange_importId_idx" ON "SupplierOfferChange"("importId");

-- CreateIndex
CREATE INDEX "SupplierOfferChange_kind_createdAt_idx" ON "SupplierOfferChange"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "Product_sourceImportId_idx" ON "Product"("sourceImportId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_sourceImportId_fkey" FOREIGN KEY ("sourceImportId") REFERENCES "SupplierImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProfile" ADD CONSTRAINT "SupplierProfile_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierImport" ADD CONSTRAINT "SupplierImport_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierImport" ADD CONSTRAINT "SupplierImport_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SupplierProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierImport" ADD CONSTRAINT "SupplierImport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierImport" ADD CONSTRAINT "SupplierImport_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierImportChunk" ADD CONSTRAINT "SupplierImportChunk_importId_fkey" FOREIGN KEY ("importId") REFERENCES "SupplierImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierImportPage" ADD CONSTRAINT "SupplierImportPage_importId_fkey" FOREIGN KEY ("importId") REFERENCES "SupplierImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierImportRow" ADD CONSTRAINT "SupplierImportRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "SupplierImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierImportRow" ADD CONSTRAINT "SupplierImportRow_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOffer" ADD CONSTRAINT "SupplierOffer_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOffer" ADD CONSTRAINT "SupplierOffer_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOffer" ADD CONSTRAINT "SupplierOffer_lastImportId_fkey" FOREIGN KEY ("lastImportId") REFERENCES "SupplierImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOfferChange" ADD CONSTRAINT "SupplierOfferChange_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "SupplierOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOfferChange" ADD CONSTRAINT "SupplierOfferChange_importId_fkey" FOREIGN KEY ("importId") REFERENCES "SupplierImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_code_check" CHECK ("code" ~ '^[A-Z0-9]{2,12}$');
ALTER TABLE "SupplierImport" ADD CONSTRAINT "SupplierImport_size_check" CHECK ("fileSize" > 0);
ALTER TABLE "SupplierOffer" ADD CONSTRAINT "SupplierOffer_values_check" CHECK (
  ("purchasePrice" IS NULL OR "purchasePrice" >= 0) AND
  ("purchasePriceInclTax" IS NULL OR "purchasePriceInclTax" >= 0) AND
  ("msrp" IS NULL OR "msrp" >= 0) AND
  ("stock" IS NULL OR "stock" >= 0) AND
  ("minOrderQty" IS NULL OR "minOrderQty" > 0) AND
  ("packSize" IS NULL OR "packSize" > 0)
);
