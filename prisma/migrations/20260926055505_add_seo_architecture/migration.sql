-- CreateEnum
CREATE TYPE "SlugEntity" AS ENUM ('PRODUCT', 'CATEGORY', 'SET', 'GAME');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "faq" JSONB,
ADD COLUMN     "intro" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "gameId" UUID,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT;

-- AlterTable
ALTER TABLE "TcgSet" ADD COLUMN     "faq" JSONB,
ADD COLUMN     "gameId" UUID,
ADD COLUMN     "intro" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT;

-- CreateTable
CREATE TABLE "Game" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortName" TEXT,
    "description" TEXT,
    "intro" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "faq" JSONB,
    "logoUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlugRedirect" (
    "id" UUID NOT NULL,
    "entityType" "SlugEntity" NOT NULL,
    "fromSlug" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlugRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_slug_key" ON "Game"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SlugRedirect_entityType_fromSlug_key" ON "SlugRedirect"("entityType", "fromSlug");

-- CreateIndex
CREATE INDEX "Product_gameId_idx" ON "Product"("gameId");

-- CreateIndex
CREATE INDEX "TcgSet_gameId_idx" ON "TcgSet"("gameId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TcgSet" ADD CONSTRAINT "TcgSet_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
