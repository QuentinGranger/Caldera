ALTER TABLE "NewsletterCampaign" ADD COLUMN "scheduledAt" TIMESTAMP(3), ADD COLUMN "sendImmediately" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CarnetChapter" ADD COLUMN "releaseCampaignId" UUID;
CREATE UNIQUE INDEX "CarnetChapter_releaseCampaignId_key" ON "CarnetChapter"("releaseCampaignId");
ALTER TABLE "CarnetChapter" ADD CONSTRAINT "CarnetChapter_releaseCampaignId_fkey" FOREIGN KEY ("releaseCampaignId") REFERENCES "NewsletterCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
