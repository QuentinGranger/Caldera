CREATE TABLE "MeasurementSession" (
  "id" UUID NOT NULL, "visitorHash" CHAR(64) NOT NULL,
  "channel" VARCHAR(24) NOT NULL, "source" VARCHAR(80) NOT NULL, "campaign" VARCHAR(80),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "productViewed" BOOLEAN NOT NULL DEFAULT false, "cartAdded" BOOLEAN NOT NULL DEFAULT false,
  "checkoutStarted" BOOLEAN NOT NULL DEFAULT false, "paymentStarted" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "MeasurementSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MeasurementSession_startedAt_channel_idx" ON "MeasurementSession"("startedAt", "channel");
CREATE INDEX "MeasurementSession_visitorHash_idx" ON "MeasurementSession"("visitorHash");
CREATE TABLE "MeasurementOrder" (
  "orderId" UUID NOT NULL, "sessionId" UUID NOT NULL,
  CONSTRAINT "MeasurementOrder_pkey" PRIMARY KEY ("orderId"),
  CONSTRAINT "MeasurementOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MeasurementOrder_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MeasurementSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "MeasurementOrder_sessionId_idx" ON "MeasurementOrder"("sessionId");
