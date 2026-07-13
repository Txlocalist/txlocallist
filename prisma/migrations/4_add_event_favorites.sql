-- Add real per-user saved events and aggregate save counts.
CREATE TABLE IF NOT EXISTS "EventFavorite" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventFavorite_userId_eventId_key"
  ON "EventFavorite"("userId", "eventId");
CREATE INDEX IF NOT EXISTS "EventFavorite_userId_idx"
  ON "EventFavorite"("userId");
CREATE INDEX IF NOT EXISTS "EventFavorite_eventId_idx"
  ON "EventFavorite"("eventId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EventFavorite_userId_fkey'
  ) THEN
    ALTER TABLE "EventFavorite"
      ADD CONSTRAINT "EventFavorite_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EventFavorite_eventId_fkey'
  ) THEN
    ALTER TABLE "EventFavorite"
      ADD CONSTRAINT "EventFavorite_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "Event"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
