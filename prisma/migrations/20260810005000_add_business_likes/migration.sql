-- Add real per-user business likes and aggregate like counts.
CREATE TABLE IF NOT EXISTS "Like" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Like_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Like_userId_businessId_key"
  ON "Like"("userId", "businessId");
CREATE INDEX IF NOT EXISTS "Like_userId_idx"
  ON "Like"("userId");
CREATE INDEX IF NOT EXISTS "Like_businessId_idx"
  ON "Like"("businessId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Like_userId_fkey'
  ) THEN
    ALTER TABLE "Like"
      ADD CONSTRAINT "Like_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Like_businessId_fkey'
  ) THEN
    ALTER TABLE "Like"
      ADD CONSTRAINT "Like_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
