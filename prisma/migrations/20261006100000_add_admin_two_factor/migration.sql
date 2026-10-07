ALTER TABLE "AdminUser"
  ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "AdminTwoFactor" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "secret" TEXT NOT NULL,
  "backupCodes" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT true,
  "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  CONSTRAINT "AdminTwoFactor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminTwoFactor_userId_idx" ON "AdminTwoFactor"("userId");
CREATE INDEX "AdminTwoFactor_secret_idx" ON "AdminTwoFactor"("secret");
ALTER TABLE "AdminTwoFactor" ADD CONSTRAINT "AdminTwoFactor_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
