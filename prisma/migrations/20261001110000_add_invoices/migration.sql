-- CreateEnum
CREATE TYPE "VatRegime" AS ENUM ('FRANCHISE', 'STANDARD');

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('INVOICE', 'CREDIT_NOTE');

-- CreateTable
CREATE TABLE "InvoiceSettings" (
    "id" TEXT NOT NULL DEFAULT 'caldera',
    "legalName" TEXT NOT NULL DEFAULT 'CALDERA',
    "tradeName" TEXT NOT NULL DEFAULT 'Les Terres de Caldera',
    "legalForm" TEXT NOT NULL DEFAULT 'SASU',
    "shareCapital" TEXT,
    "street" TEXT NOT NULL DEFAULT '74 rue Pierre Valdo',
    "postalCode" TEXT NOT NULL DEFAULT '69005',
    "city" TEXT NOT NULL DEFAULT 'Lyon',
    "country" TEXT NOT NULL DEFAULT 'France',
    "siren" TEXT,
    "siret" TEXT,
    "rcsCity" TEXT,
    "vatNumber" TEXT,
    "email" TEXT NOT NULL DEFAULT 'contact@lesterresdecaldera.fr',
    "vatRegime" "VatRegime" NOT NULL DEFAULT 'FRANCHISE',
    "defaultVatRate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "footer" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "id" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "kind" "InvoiceKind" NOT NULL,
    "number" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "orderId" UUID NOT NULL,
    "refundId" UUID,
    "invoiceId" UUID,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" CHAR(3) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_dedupeKey_key" ON "Invoice"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_refundId_key" ON "Invoice"("refundId");

-- CreateIndex
CREATE INDEX "Invoice_orderId_idx" ON "Invoice"("orderId");

-- CreateIndex
CREATE INDEX "Invoice_kind_issuedAt_idx" ON "Invoice"("kind", "issuedAt");

-- CreateIndex
CREATE INDEX "Invoice_invoiceId_idx" ON "Invoice"("invoiceId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Money and numbering invariants.
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_amounts_check"
  CHECK ("totalAmount" >= 0 AND "taxAmount" >= 0 AND "taxAmount" <= "totalAmount");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_kind_check" CHECK (
  ("kind" = 'INVOICE' AND "refundId" IS NULL AND "invoiceId" IS NULL) OR
  ("kind" = 'CREDIT_NOTE' AND "refundId" IS NOT NULL AND "invoiceId" IS NOT NULL)
);
ALTER TABLE "InvoiceSequence" ADD CONSTRAINT "InvoiceSequence_next_check" CHECK ("next" >= 1);

-- Issued documents are never changed nor removed (accounting records).
-- Only a transaction of the local test suite may delete them, after setting
-- caldera.purge_test_invoices itself (SET LOCAL); nobody may ever update them.
CREATE FUNCTION "Invoice_immutable"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('caldera.purge_test_invoices', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Une facture ou un avoir émis ne peut être ni modifié ni supprimé.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Invoice_immutable"
BEFORE UPDATE OR DELETE ON "Invoice"
FOR EACH ROW EXECUTE FUNCTION "Invoice_immutable"();
