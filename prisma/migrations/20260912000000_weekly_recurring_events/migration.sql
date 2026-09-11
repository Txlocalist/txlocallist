ALTER TABLE "Event"
  ADD COLUMN "recurrence" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN "recurrenceUntil" TIMESTAMP(3);

ALTER TABLE "Event" ADD CONSTRAINT "Event_recurrence_valid" CHECK (
  ("recurrence" = 'NONE' AND "recurrenceUntil" IS NULL) OR
  ("recurrence" = 'WEEKLY' AND "postingMethod" <> 'ONE_TIME'
    AND "startDate" IS NOT NULL AND "endDate" IS NOT NULL AND "endDate" > "startDate"
    AND ("recurrenceUntil" IS NULL OR "recurrenceUntil" >= "endDate"))
);
CREATE INDEX "Event_recurrence_recurrenceUntil_idx" ON "Event"("recurrence", "recurrenceUntil");
