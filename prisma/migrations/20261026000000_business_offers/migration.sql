CREATE TABLE "BusinessOffer" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "headline" VARCHAR(100) NOT NULL,
    "description" VARCHAR(600) NOT NULL,
    "instructions" VARCHAR(400) NOT NULL,
    "code" VARCHAR(60),
    "terms" VARCHAR(500),
    "startDate" VARCHAR(10),
    "endDate" VARCHAR(10),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessOffer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BusinessOffer_order_check" CHECK ("order" BETWEEN 0 AND 2),
    CONSTRAINT "BusinessOffer_date_order_check" CHECK ("startDate" IS NULL OR "endDate" IS NULL OR "startDate" <= "endDate"),
    CONSTRAINT "BusinessOffer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BusinessOffer_businessId_order_key" ON "BusinessOffer"("businessId", "order");
CREATE INDEX "BusinessOffer_enabled_startDate_endDate_idx" ON "BusinessOffer"("enabled", "startDate", "endDate");
