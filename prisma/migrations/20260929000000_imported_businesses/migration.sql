CREATE TABLE "ImportedBusiness" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "cityId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportedBusiness_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImportedBusiness_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ImportedBusiness_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "BusinessImportState" (
  "id" TEXT NOT NULL DEFAULT 'directory',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "lastImportedAt" TIMESTAMP(3),
  "lastFileName" TEXT,
  "lastImportedBy" TEXT,
  "lastFileHash" TEXT,
  CONSTRAINT "BusinessImportState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BusinessImportState_singleton" CHECK ("id" = 'directory')
);
INSERT INTO "BusinessImportState" ("id") VALUES ('directory');
CREATE INDEX "ImportedBusiness_cityId_categoryId_idx" ON "ImportedBusiness" ("cityId", "categoryId");
CREATE INDEX "ImportedBusiness_categoryId_idx" ON "ImportedBusiness" ("categoryId");
-- Name/city uniqueness is validated with the same normalization as public
-- suppression. City deletion blocks any resulting fallback-city collisions.
CREATE INDEX "ImportedBusiness_name_match_idx" ON "ImportedBusiness" (lower(btrim("name")), "id");
CREATE INDEX "Business_city_name_match_idx" ON "Business" ("cityId", lower(btrim("name")));
