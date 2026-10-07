CREATE TABLE "CustomerDiscordLink" (
  "customerId" UUID NOT NULL,
  "discordUserId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "roleGrantedAt" TIMESTAMP(3),
  CONSTRAINT "CustomerDiscordLink_pkey" PRIMARY KEY ("customerId")
);
CREATE UNIQUE INDEX "CustomerDiscordLink_discordUserId_key" ON "CustomerDiscordLink"("discordUserId");
ALTER TABLE "CustomerDiscordLink" ADD CONSTRAINT "CustomerDiscordLink_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DiscordOAuthState" (
  "stateHash" CHAR(64) NOT NULL,
  "sessionId" UUID NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscordOAuthState_pkey" PRIMARY KEY ("stateHash")
);
CREATE UNIQUE INDEX "DiscordOAuthState_sessionId_key" ON "DiscordOAuthState"("sessionId");
CREATE INDEX "DiscordOAuthState_expiresAt_idx" ON "DiscordOAuthState"("expiresAt");
ALTER TABLE "DiscordOAuthState" ADD CONSTRAINT "DiscordOAuthState_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CustomerSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
