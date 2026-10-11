ALTER TABLE "NewsletterSubscriber"
ADD COLUMN "emailTracking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "emailTrackingConsentAt" TIMESTAMP(3),
ADD COLUMN "emailTrackingConsentVersion" TEXT;
ALTER TABLE "NewsletterCampaignDelivery"
ADD COLUMN "trackingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "trackingConsentAt" TIMESTAMP(3),
ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "openedAt" TIMESTAMP(3),
ADD COLUMN "clickedAt" TIMESTAMP(3);
CREATE INDEX "NewsletterCampaignDelivery_providerMessageId_idx" ON "NewsletterCampaignDelivery"("providerMessageId");
ALTER TABLE "LifecycleDelivery"
ADD COLUMN "trackingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "trackingConsentAt" TIMESTAMP(3),
ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "openedAt" TIMESTAMP(3),
ADD COLUMN "clickedAt" TIMESTAMP(3);
CREATE INDEX "LifecycleDelivery_providerMessageId_idx" ON "LifecycleDelivery"("providerMessageId");
