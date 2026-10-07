-- Returns settled by a replacement item, customer e-mails for a received
-- parcel and a shipped replacement, and photos of the problem.
ALTER TYPE "ReturnStatus" ADD VALUE 'REPLACED';
ALTER TYPE "EmailType" ADD VALUE 'RETURN_RECEIVED';
ALTER TYPE "EmailType" ADD VALUE 'RETURN_REPLACED';
ALTER TYPE "InventoryAdjustmentType" ADD VALUE 'REPLACEMENT';

-- A replacement parcel: never the order's primary shipment, one per return.
ALTER TABLE "Shipment" ADD COLUMN "returnId" UUID;
CREATE UNIQUE INDEX "Shipment_returnId_key" ON "Shipment"("returnId");
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_replacement_check" CHECK ("returnId" IS NULL OR "isPrimary" = false);

CREATE TABLE "ReturnPhoto" (
    "id" UUID NOT NULL,
    "returnId" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "source" "ReturnSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReturnPhoto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReturnPhoto_filename_key" ON "ReturnPhoto"("filename");
CREATE INDEX "ReturnPhoto_returnId_idx" ON "ReturnPhoto"("returnId");
ALTER TABLE "ReturnPhoto" ADD CONSTRAINT "ReturnPhoto_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
