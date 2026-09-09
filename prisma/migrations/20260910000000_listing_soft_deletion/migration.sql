-- Additive: deploy before application code that reads deletedAt.
ALTER TABLE "Business" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Preserve the existing archive contract. Canceled events remain manageable;
-- cancellation alone never means an owner explicitly deleted the event.
UPDATE "Business" SET "deletedAt" = "updatedAt" WHERE "status" = 'ARCHIVED';

-- Generated sort keys guarantee case-insensitive ordering before pagination,
-- including after edits/imports that do not pass through our application.
ALTER TABLE "Business" ADD COLUMN "sortName" TEXT NOT NULL GENERATED ALWAYS AS (lower("name")) STORED;
ALTER TABLE "Event" ADD COLUMN "sortName" TEXT NOT NULL GENERATED ALWAYS AS (lower("title")) STORED;
CREATE INDEX "Business_sortName_id_idx" ON "Business" ("sortName", "id");
CREATE INDEX "Event_sortName_id_idx" ON "Event" ("sortName", "id");

-- User results use the displayed name, falling back to email for unnamed users.
ALTER TABLE "User" ADD COLUMN "sortName" TEXT NOT NULL
  GENERATED ALWAYS AS (lower(COALESCE(NULLIF(btrim("name"), ''), "email"))) STORED;
CREATE INDEX "User_sortName_id_idx" ON "User" ("sortName", "id");
