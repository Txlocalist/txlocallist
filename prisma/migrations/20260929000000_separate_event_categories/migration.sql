BEGIN;

CREATE TABLE "EventCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventCategory_name_key" ON "EventCategory"("name");
CREATE UNIQUE INDEX "EventCategory_slug_key" ON "EventCategory"("slug");

ALTER TABLE "Event" ADD COLUMN "categoryId" TEXT;
CREATE INDEX "Event_categoryId_idx" ON "Event"("categoryId");
ALTER TABLE "Event" ADD CONSTRAINT "Event_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "EventCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the existing event form choices as managed event categories.
INSERT INTO "EventCategory" ("id", "name", "slug")
SELECT 'event-category-' || slug, name, slug FROM (VALUES
  ('Live Music', 'live-music'), ('Family Friendly', 'family-friendly'),
  ('Food & Drink', 'food-and-drink'), ('Networking', 'networking'),
  ('Arts & Culture', 'arts-and-culture'), ('Outdoor', 'outdoor'),
  ('Wellness', 'wellness'), ('Community', 'community'),
  ('Farmers Market', 'farmers-market'), ('Craft Fair', 'craft-fair'),
  ('Vaccination Clinics', 'vaccination-clinics'), ('Festival', 'festival'),
  ('Fundraiser', 'fundraiser'), ('Cultural Event', 'cultural-event'),
  ('Yard Sale', 'yard-sale'), ('Other', 'other')
) AS defaults(name, slug);

-- Carry forward explicit category tags and the display labels previously inferred
-- for older events. Include drafts, ended events and archived events as well.
CREATE TEMP TABLE "_EventCategoryBackfill" ON COMMIT DROP AS
SELECT e."id" AS "eventId", COALESCE(tags.explicit_category,
  CASE
    WHEN LOWER(CONCAT_WS(' ', e."title", e."description", tags.tag_text)) ~ '(karaoke|karokee|music|concert|band|open mic)' THEN 'Live Music'
    WHEN LOWER(CONCAT_WS(' ', e."title", e."description", tags.tag_text)) ~ '(market|yard sale|vendor|fair|makers)' THEN 'Markets'
    WHEN LOWER(CONCAT_WS(' ', e."title", e."description", tags.tag_text)) ~ '(food|drink|pizza|beer|taco)' THEN 'Food & Drink'
    WHEN LOWER(CONCAT_WS(' ', e."title", e."description", tags.tag_text)) ~ '(night|dj|dance)' THEN 'Nightlife'
    WHEN LOWER(CONCAT_WS(' ', e."title", e."description", tags.tag_text)) ~ '(family|kids|park|responders)' THEN 'Family'
    WHEN LOWER(CONCAT_WS(' ', e."title", e."description", tags.tag_text)) ~ '(outdoor|patio|trail)' THEN 'Outdoor'
    ELSE COALESCE(tags.first_tag, 'Community')
  END) AS "name"
FROM "Event" e LEFT JOIN LATERAL (
  SELECT
    (ARRAY_AGG(BTRIM(SUBSTRING(t."name" FROM 17)) ORDER BY t."id") FILTER (
      WHERE t."name" LIKE 'Event Category: %' AND BTRIM(SUBSTRING(t."name" FROM 17)) <> ''
    ))[1] AS explicit_category,
    STRING_AGG(t."name", ' ' ORDER BY t."id") AS tag_text,
    (ARRAY_AGG(t."name" ORDER BY t."id") FILTER (WHERE t."name" NOT LIKE 'Event Category: %'))[1] AS first_tag
  FROM "_EventToTag" link JOIN "Tag" t ON t."id" = link."B" WHERE link."A" = e."id"
) tags ON TRUE;

-- Legacy inferred labels can be outside the former fixed list. Preserve them
-- rather than silently moving existing events into a different category.
INSERT INTO "EventCategory" ("id", "name", "slug")
SELECT 'event-category-' || MD5(LOWER(source."name")), source."name",
  TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(source."name"), '[^a-z0-9]+', '-', 'g')) || '-' || SUBSTRING(MD5(LOWER(source."name")) FROM 1 FOR 12)
FROM (SELECT DISTINCT ON (LOWER("name")) "name" FROM "_EventCategoryBackfill" ORDER BY LOWER("name"), "name") source
WHERE NOT EXISTS (SELECT 1 FROM "EventCategory" existing WHERE LOWER(existing."name") = LOWER(source."name"));

UPDATE "Event" e SET "categoryId" = c."id"
FROM "_EventCategoryBackfill" source JOIN "EventCategory" c ON LOWER(c."name") = LOWER(source."name")
WHERE e."id" = source."eventId";

-- Keep old tag rows for rollback compatibility. New code hides reserved category
-- tags from ordinary tag controls and writes the category relation instead.
COMMIT;
