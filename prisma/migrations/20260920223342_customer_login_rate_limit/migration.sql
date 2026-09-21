-- CreateTable
CREATE TABLE "CustomerLoginAttempt" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerLoginAttempt_pkey" PRIMARY KEY ("key")
);
