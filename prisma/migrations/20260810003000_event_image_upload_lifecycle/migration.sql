-- Existing rows were successfully written to Blob before this lifecycle marker existed.
ALTER TABLE "EventImageUpload"
ADD COLUMN "readyAt" TIMESTAMP(3),
ADD COLUMN "cleanupStartedAt" TIMESTAMP(3),
ADD COLUMN "cleanupAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "cleanupError" TEXT;

UPDATE "EventImageUpload"
SET "readyAt" = "createdAt"
WHERE "readyAt" IS NULL;

CREATE INDEX "EventImageUpload_eventId_createdAt_cleanupStartedAt_idx"
ON "EventImageUpload"("eventId", "createdAt", "cleanupStartedAt");

CREATE TABLE "EventImageUploadRateLimit" (
  "userId" TEXT NOT NULL,
  "windowStartedAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventImageUploadRateLimit_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "EventImageUploadRateLimit_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "EventImageUploadRateLimit_windowStartedAt_idx"
ON "EventImageUploadRateLimit"("windowStartedAt");
