ALTER TABLE "NewsletterSubscriber" ADD COLUMN "pendingAcquisitionChannel" TEXT;

CREATE TABLE "NewsletterConfirmationDaily" (
    "day" DATE NOT NULL,
    "channel" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    CONSTRAINT "NewsletterConfirmationDaily_pkey" PRIMARY KEY ("day", "channel")
);

-- Existing confirmations have no recorded channel. Seed only the two periods
-- the first weekly reports can use, and keep the live-list count separate.
INSERT INTO "NewsletterConfirmationDaily" ("day", "channel", "count")
SELECT (("confirmedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Paris')::date,
       'unknown', COUNT(*)::integer
FROM "NewsletterSubscriber"
WHERE "confirmedAt" >= CURRENT_TIMESTAMP - INTERVAL '21 days'
GROUP BY 1;
