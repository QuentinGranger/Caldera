-- CreateTable
CREATE TABLE "CarnetReading" (
    "id" UUID NOT NULL,
    "chapterId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "productViewedAt" TIMESTAMP(3),

    CONSTRAINT "CarnetReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarnetEmailClick" (
    "deliveryId" UUID NOT NULL,
    "linkKey" VARCHAR(24) NOT NULL,
    "productId" UUID,
    "clickedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarnetEmailClick_pkey" PRIMARY KEY ("deliveryId","linkKey")
);

-- CreateIndex
CREATE INDEX "CarnetReading_chapterId_viewedAt_idx" ON "CarnetReading"("chapterId", "viewedAt");

-- CreateIndex
CREATE INDEX "CarnetReading_viewedAt_idx" ON "CarnetReading"("viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CarnetReading_sessionId_chapterId_key" ON "CarnetReading"("sessionId", "chapterId");

-- CreateIndex
CREATE INDEX "CarnetEmailClick_clickedAt_idx" ON "CarnetEmailClick"("clickedAt");

-- AddForeignKey
ALTER TABLE "CarnetReading" ADD CONSTRAINT "CarnetReading_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "CarnetChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarnetReading" ADD CONSTRAINT "CarnetReading_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MeasurementSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarnetEmailClick" ADD CONSTRAINT "CarnetEmailClick_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "NewsletterCampaignDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep the small event vocabulary and timestamp windows consistent at database level.
ALTER TABLE "CarnetEmailClick" ADD CONSTRAINT "CarnetEmailClick_linkKey_check"
CHECK ("linkKey" IN ('story_continue', 'comptoir_product_1', 'comptoir_product_2', 'comptoir_product_3'));
ALTER TABLE "CarnetReading" ADD CONSTRAINT "CarnetReading_chronology_check"
CHECK (("completedAt" IS NULL OR "completedAt" >= "viewedAt") AND
 ("productViewedAt" IS NULL OR ("productViewedAt" >= "viewedAt" AND "productViewedAt" <= "viewedAt" + INTERVAL '24 hours')));
