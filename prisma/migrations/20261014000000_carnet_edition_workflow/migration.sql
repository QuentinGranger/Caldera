ALTER TABLE "NewsletterCampaign" ADD COLUMN "carnetCustomized" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "carnetProducts" JSONB;
ALTER TABLE "CarnetChapter" ADD COLUMN "editionCampaignId" UUID;
CREATE UNIQUE INDEX "CarnetChapter_editionCampaignId_key" ON "CarnetChapter"("editionCampaignId");
ALTER TABLE "CarnetChapter" ADD CONSTRAINT "CarnetChapter_editionCampaignId_fkey" FOREIGN KEY ("editionCampaignId") REFERENCES "NewsletterCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "CarnetComptoirProduct" (
 "chapterId" UUID NOT NULL, "productId" UUID NOT NULL, "position" INTEGER NOT NULL,
 CONSTRAINT "CarnetComptoirProduct_pkey" PRIMARY KEY ("chapterId", "productId"),
 CONSTRAINT "CarnetComptoirProduct_position_check" CHECK ("position" BETWEEN 0 AND 2),
 CONSTRAINT "CarnetComptoirProduct_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "CarnetChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "CarnetComptoirProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CarnetComptoirProduct_chapterId_position_key" ON "CarnetComptoirProduct"("chapterId", "position");
CREATE INDEX "CarnetComptoirProduct_productId_idx" ON "CarnetComptoirProduct"("productId");
