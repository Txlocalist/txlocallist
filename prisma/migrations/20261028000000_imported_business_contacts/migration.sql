-- Contact details are admin-only. Existing imports remain valid without them.
ALTER TABLE "ImportedBusiness"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "address" TEXT;
