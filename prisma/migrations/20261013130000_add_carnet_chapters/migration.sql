-- CreateEnum
CREATE TYPE "CarnetChapterStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');

-- CreateTable
CREATE TABLE "CarnetChapter" (
    "id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "arcTitle" VARCHAR(200),
    "arcPosition" INTEGER,
    "arcTotal" INTEGER,
    "content" JSONB NOT NULL,
    "status" "CarnetChapterStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarnetChapter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CarnetChapter_number_key" ON "CarnetChapter"("number");

-- CreateIndex
CREATE UNIQUE INDEX "CarnetChapter_slug_key" ON "CarnetChapter"("slug");

-- CreateIndex
CREATE INDEX "CarnetChapter_status_updatedAt_idx" ON "CarnetChapter"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "CarnetChapter_createdById_idx" ON "CarnetChapter"("createdById");

-- AddForeignKey
ALTER TABLE "CarnetChapter" ADD CONSTRAINT "CarnetChapter_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Basic invariants also hold for database-side administration.
ALTER TABLE "CarnetChapter"
  ADD CONSTRAINT "CarnetChapter_number_check" CHECK ("number" BETWEEN 1 AND 999999),
  ADD CONSTRAINT "CarnetChapter_title_check" CHECK (btrim("title") <> ''),
  ADD CONSTRAINT "CarnetChapter_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD CONSTRAINT "CarnetChapter_revision_check" CHECK ("revision" >= 0),
  ADD CONSTRAINT "CarnetChapter_arc_check" CHECK (
    ("arcPosition" IS NULL AND "arcTotal" IS NULL) OR
    ("arcTitle" IS NOT NULL AND btrim("arcTitle") <> '' AND
     "arcPosition" IS NOT NULL AND "arcTotal" IS NOT NULL AND
     "arcPosition" BETWEEN 1 AND 1000 AND "arcTotal" BETWEEN 1 AND 1000 AND
     "arcPosition" <= "arcTotal")
  );
