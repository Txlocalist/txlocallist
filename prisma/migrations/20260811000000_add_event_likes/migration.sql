-- Add real per-user event likes and aggregate like counts.
CREATE TABLE IF NOT EXISTS "EventLike" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventLike_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventLike_userId_eventId_key"
  ON "EventLike"("userId", "eventId");
CREATE INDEX IF NOT EXISTS "EventLike_userId_idx"
  ON "EventLike"("userId");
CREATE INDEX IF NOT EXISTS "EventLike_eventId_idx"
  ON "EventLike"("eventId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EventLike_userId_fkey'
  ) THEN
    ALTER TABLE "EventLike"
      ADD CONSTRAINT "EventLike_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EventLike_eventId_fkey'
  ) THEN
    ALTER TABLE "EventLike"
      ADD CONSTRAINT "EventLike_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "Event"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
