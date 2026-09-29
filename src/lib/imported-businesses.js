import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { importedBusinessNotSuppressedSql } from "@/lib/listing-visibility-sql";

export const IMPORT_STATE_ID = "directory";
export const OTHER_BUSINESSES_PAGE_SIZE = 25;
const PREVIEW_LIMIT = 100;

function importError(message, status = 400, extra = {}) {
  return Object.assign(new Error(message), { status, ...extra });
}

export function isImportSchemaMissing(error) {
  const text = `${error?.message ?? ""} ${JSON.stringify(error?.meta ?? {})}`;
  return /ImportedBusiness|BusinessImportState/.test(text)
    && (error?.code === "P2021" || error?.code === "P2022" || /42P01|does not exist/.test(text));
}

function handleImportError(error) {
  if (isImportSchemaMissing(error)) {
    throw importError("Business imports are not available until the database update is installed.", 503);
  }
  throw error;
}

export async function getImportTaxonomy(db = prisma) {
  const [cities, categories] = await Promise.all([
    db.city.findMany({ select: { id: true, name: true, slug: true }, orderBy: { id: "asc" } }),
    db.category.findMany({ select: { id: true, name: true, slug: true }, orderBy: { id: "asc" } }),
  ]);
  return { cities, categories };
}

function taxonomyDigest(taxonomy) {
  return createHash("sha256").update(JSON.stringify(taxonomy)).digest("hex");
}

async function importState(db) {
  return await db.businessImportState.findUnique({ where: { id: IMPORT_STATE_ID } })
    ?? { revision: 0, lastImportedAt: null, lastFileName: null, lastImportedBy: null };
}

export async function getImportAdminState(db = prisma) {
  try {
    const [state] = await db.$queryRaw`
      SELECT COALESCE(s."revision", 0) AS "revision", s."lastImportedAt", s."lastFileName", s."lastImportedBy",
        (SELECT count(*)::int FROM "ImportedBusiness") AS "total"
      FROM (SELECT ${IMPORT_STATE_ID}::text AS "id") d
      LEFT JOIN "BusinessImportState" s ON s."id" = d."id"`;
    return {
      revision: state.revision, total: state.total, lastImportedAt: state.lastImportedAt?.toISOString() ?? null,
      lastFileName: state.lastFileName, lastImportedBy: state.lastImportedBy,
    };
  } catch (error) { return handleImportError(error); }
}

// Resolve and normalize using the database's own case folding, also used for
// duplicate suppression. JS locale/case conversion must not decide identity.
async function resolveRows(db, rows) {
  if (!rows.length) return [];
  return db.$queryRaw`
    SELECT r."row", btrim(r."name") AS "name", lower(btrim(r."name")) AS "nameKey",
      r."city", r."category", c."id" AS "cityId", k."id" AS "categoryId"
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
      AS r("row" integer, "name" text, "city" text, "category" text)
    LEFT JOIN "City" c ON lower(btrim(c."name")) = lower(btrim(r."city"))
    LEFT JOIN "Category" k ON lower(btrim(k."name")) = lower(btrim(r."category"))
    ORDER BY r."row"`;
}

function validateResolvedRows(parsed, rows) {
  const issues = [...parsed.issues];
  let issueCount = parsed.issueCount;
  const seen = new Map();
  const add = (row, field, message) => {
    issueCount++;
    if (issues.length < PREVIEW_LIMIT) issues.push({ row, field, message });
  };
  for (const row of rows) {
    if (!row.cityId) add(row.row, "City", `Unknown city: ${row.city}. Correct the value or add it in Admin → Cities.`);
    if (!row.categoryId) add(row.row, "Category", `Unknown category: ${row.category}. Correct the value or add it in Admin → Business Categories.`);
    if (!row.cityId) continue;
    const key = JSON.stringify([row.cityId, row.nameKey]);
    if (seen.has(key)) add(row.row, "Name", `Duplicate business name and city; first entered on row ${seen.get(key)}.`);
    else seen.set(key, row.row);
  }
  return { issues, issueCount };
}

async function getPreview(db, parsed) {
  const [taxonomy, state, rows, oldRows] = await Promise.all([
    getImportTaxonomy(db), importState(db), resolveRows(db, parsed.rows),
    db.$queryRaw`SELECT "name", lower(btrim("name")) AS "nameKey", "cityId", "categoryId" FROM "ImportedBusiness"`,
  ]);
  const validation = validateResolvedRows(parsed, rows);
  const key = (row) => JSON.stringify([row.cityId, row.nameKey]);
  const old = new Map();
  for (const row of oldRows) {
    const group = old.get(key(row)) ?? [];
    group.push(row);
    old.set(key(row), group);
  }
  const summary = { total: rows.length, added: 0, changed: 0, removed: 0, unchanged: 0, hidden: 0 };
  for (const row of rows) {
    const previous = old.get(key(row))?.shift();
    if (!previous) summary.added++;
    else if (previous.name !== row.name || previous.categoryId !== row.categoryId) summary.changed++;
    else summary.unchanged++;
  }
  summary.removed = [...old.values()].reduce((total, group) => total + group.length, 0);
  if (!validation.issueCount) {
    const [hidden] = await db.$queryRaw`
      SELECT count(*)::int AS "count" FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
        AS i("name" text, "cityId" text)
      WHERE NOT (${importedBusinessNotSuppressedSql()})`;
    summary.hidden = hidden.count;
  }
  return {
    fileHash: parsed.fileHash, revision: state.revision, taxonomyDigest: taxonomyDigest(taxonomy),
    canPublish: validation.issueCount === 0 && rows.length > 0, ...validation, summary,
    rows: rows.slice(0, PREVIEW_LIMIT).map(({ row, name, city, category }) => ({ row, name, city, category })),
    resolvedRows: rows,
  };
}

export async function previewImportedBusinesses(file) {
  const { parseBusinessSpreadsheet } = await import("@/lib/business-import-file");
  const parsed = await parseBusinessSpreadsheet(file);
  try {
    const { resolvedRows: _resolvedRows, ...preview } = await prisma.$transaction(
      (tx) => getPreview(tx, parsed), { isolationLevel: "RepeatableRead", timeout: 30000 },
    );
    return preview;
  } catch (error) { return handleImportError(error); }
}

export async function publishImportedBusinesses(file, expected, admin) {
  if (admin?.role !== "ADMIN") throw importError("Administrator access is required.", 403);
  const { parseBusinessSpreadsheet } = await import("@/lib/business-import-file");
  const parsed = await parseBusinessSpreadsheet(file);
  if (!expected?.fileHash || parsed.fileHash !== expected.fileHash) {
    throw importError("The selected file changed. Preview it again before publishing.", 409);
  }
  if (!Number.isSafeInteger(Number(expected.revision)) || Number(expected.revision) < 0 || !expected.taxonomyDigest) {
    throw importError("Preview the file before publishing.", 409);
  }
  try {
    return await prisma.$transaction(async (tx) => {
      // Same order as city deletion; prevent taxonomy changes during resolution.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('txlocalist:city-management'))`;
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('txlocalist:categories:business'))`;
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('txlocalist:business-import'))`;
      const preview = await getPreview(tx, parsed);
      if (preview.revision !== Number(expected.revision) || preview.taxonomyDigest !== expected.taxonomyDigest) {
        throw importError("The directory, cities, or categories changed. Preview the file again before publishing.", 409);
      }
      if (!preview.canPublish) {
        throw importError("Correct all spreadsheet errors and preview the file again.", 400, {
          issues: preview.issues, issueCount: preview.issueCount,
        });
      }
      await tx.importedBusiness.deleteMany();
      for (let start = 0; start < preview.resolvedRows.length; start += 1000) {
        await tx.importedBusiness.createMany({ data: preview.resolvedRows.slice(start, start + 1000)
          .map(({ name, cityId, categoryId }) => ({ name, cityId, categoryId })) });
      }
      const metadata = {
        lastImportedAt: new Date(), lastFileName: file.name.slice(0, 255),
        lastImportedBy: admin.email || admin.id, lastFileHash: parsed.fileHash,
      };
      const state = await tx.businessImportState.upsert({
        where: { id: IMPORT_STATE_ID },
        create: { id: IMPORT_STATE_ID, revision: 1, ...metadata },
        update: { revision: { increment: 1 }, ...metadata },
      });
      await tx.auditLog.create({ data: {
        actorId: admin.id, action: "IMPORT_REPLACE", entity: "ImportedBusiness", entityId: IMPORT_STATE_ID,
        meta: JSON.stringify({ revision: state.revision, fileName: metadata.lastFileName, fileHash: parsed.fileHash, ...preview.summary }),
      } });
      return {
        revision: state.revision, total: preview.summary.total,
        lastImportedAt: metadata.lastImportedAt.toISOString(),
        lastFileName: metadata.lastFileName, lastImportedBy: metadata.lastImportedBy,
      };
    }, { isolationLevel: "ReadCommitted", timeout: 30000, maxWait: 10000 });
  } catch (error) { return handleImportError(error); }
}

export async function exportImportedBusinesses() {
  try {
    const rows = await prisma.importedBusiness.findMany({
      select: { name: true, city: { select: { name: true } }, category: { select: { name: true } } },
      orderBy: [{ name: "asc" }, { cityId: "asc" }, { id: "asc" }],
    });
    return rows.map(({ name, city, category }) => ({ name, city: city.name, category: category.name }));
  } catch (error) { return handleImportError(error); }
}

export async function getImportedBusinessCategories() {
  try {
    return await prisma.$queryRaw`
      SELECT k."id", k."name", k."slug" FROM "Category" k
      WHERE EXISTS (SELECT 1 FROM "ImportedBusiness" i
        WHERE i."categoryId" = k."id" AND ${importedBusinessNotSuppressedSql()})
      ORDER BY k."name"`;
  } catch (error) {
    if (isImportSchemaMissing(error)) return [];
    throw error;
  }
}

export async function searchImportedBusinesses({ q = "", loc = "", category = "", citySlug = "", page = 1 } = {}) {
  const pageNumber = Math.min(400, Math.max(1, Number.parseInt(page, 10) || 1));
  const conditions = [importedBusinessNotSuppressedSql()];
  // position() searches literal input: %, _ and backslashes are not wildcards.
  if (q.trim()) conditions.push(Prisma.sql`(position(lower(${q.trim()}) in lower(i."name")) > 0
    OR position(lower(${q.trim()}) in lower(k."name")) > 0)`);
  if (citySlug) conditions.push(Prisma.sql`c."slug" = ${citySlug}`);
  else if (loc.trim()) {
    const cityOnly = loc.trim().replace(/,?\s+[a-zA-Z]{2}$/, "").trim();
    conditions.push(Prisma.sql`(c."slug" = ${cityOnly.toLowerCase().replace(/\s+/g, "-")}
      OR position(lower(${cityOnly}) in lower(c."name")) > 0)`);
  }
  if (category.trim()) conditions.push(Prisma.sql`k."slug" = ${category.trim().toLowerCase().replace(/\s+/g, "-")}`);
  try {
    // One statement gives counts, page, and revision the same MVCC snapshot.
    const [data] = await prisma.$queryRaw`
      WITH visible AS (
        SELECT i."id", i."name", lower(btrim(i."name")) AS "sortKey",
          json_build_object('id', c."id", 'name', c."name", 'slug', c."slug") AS "city",
          json_build_object('id', k."id", 'name', k."name", 'slug', k."slug") AS "category"
        FROM "ImportedBusiness" i JOIN "City" c ON c."id" = i."cityId"
        JOIN "Category" k ON k."id" = i."categoryId"
        WHERE ${Prisma.join(conditions, " AND ")}
      ), paged AS (
        SELECT * FROM visible ORDER BY "sortKey", "id"
        LIMIT ${OTHER_BUSINESSES_PAGE_SIZE} OFFSET ${(pageNumber - 1) * OTHER_BUSINESSES_PAGE_SIZE}
      )
      SELECT (SELECT count(*)::int FROM visible) AS "total",
        COALESCE((SELECT json_agg(json_build_object('id', "id", 'name', "name", 'city', "city", 'category', "category")
          ORDER BY "sortKey", "id") FROM paged), '[]'::json) AS "results",
        COALESCE((SELECT "revision" FROM "BusinessImportState" WHERE "id" = ${IMPORT_STATE_ID}), 0) AS "revision"`;
    return { ...data, page: pageNumber, pageSize: OTHER_BUSINESSES_PAGE_SIZE,
      hasMore: pageNumber * OTHER_BUSINESSES_PAGE_SIZE < data.total };
  } catch (error) { return handleImportError(error); }
}
