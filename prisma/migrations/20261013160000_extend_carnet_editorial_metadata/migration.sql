-- Publication states are reserved; no route or scheduler is activated here.
ALTER TYPE "CarnetChapterStatus" ADD VALUE 'EARLY_ACCESS' BEFORE 'ARCHIVED';
ALTER TYPE "CarnetChapterStatus" ADD VALUE 'PUBLIC' BEFORE 'ARCHIVED';
ALTER TABLE "CarnetChapter"
  ADD COLUMN "illustrationUrl" VARCHAR(500),
  ADD COLUMN "illustrationAlt" VARCHAR(300),
  ADD COLUMN "location" VARCHAR(200),
  ADD COLUMN "earlyAccessAt" TIMESTAMP(3),
  ADD COLUMN "publicAt" TIMESTAMP(3),
  ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "CarnetChapter"
  ADD CONSTRAINT "CarnetChapter_calendar_check" CHECK ("earlyAccessAt" IS NULL OR "publicAt" IS NULL OR "publicAt" > "earlyAccessAt"),
  ADD CONSTRAINT "CarnetChapter_illustration_check" CHECK (("illustrationUrl" IS NULL AND "illustrationAlt" IS NULL) OR ("illustrationUrl" IS NOT NULL AND "illustrationAlt" IS NOT NULL AND btrim("illustrationAlt") <> ''));
ALTER TABLE "NewsletterCampaign" ADD COLUMN "chapterId" UUID;
CREATE INDEX "NewsletterCampaign_chapterId_idx" ON "NewsletterCampaign"("chapterId");
CREATE INDEX "CarnetChapter_status_earlyAccessAt_idx" ON "CarnetChapter"("status", "earlyAccessAt");
CREATE INDEX "CarnetChapter_status_publicAt_idx" ON "CarnetChapter"("status", "publicAt");
ALTER TABLE "NewsletterCampaign" ADD CONSTRAINT "NewsletterCampaign_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "CarnetChapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
