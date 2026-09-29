import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(), revalidatePath: vi.fn(), previewImportedBusinesses: vi.fn(), publishImportedBusinesses: vi.fn(),
  getImportTaxonomy: vi.fn(), exportImportedBusinesses: vi.fn(), createBusinessSpreadsheet: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/imported-businesses", () => ({
  previewImportedBusinesses: mocks.previewImportedBusinesses,
  publishImportedBusinesses: mocks.publishImportedBusinesses,
  getImportTaxonomy: mocks.getImportTaxonomy,
  exportImportedBusinesses: mocks.exportImportedBusinesses,
}));
vi.mock("@/lib/business-import-file", () => ({ createBusinessSpreadsheet: mocks.createBusinessSpreadsheet }));

import { POST as preview } from "@/app/api/admin/other-businesses/preview/route";
import { POST as publish } from "@/app/api/admin/other-businesses/publish/route";
import { GET as template } from "@/app/api/admin/other-businesses/template/route";
import { GET as exportList } from "@/app/api/admin/other-businesses/export/route";

const ORIGIN = "https://txlocalist.test";
const HASH = "a".repeat(64);
const TAXONOMY_HASH = "b".repeat(64);
const ADMIN = { id: "admin-1", email: "admin@example.com", role: "ADMIN" };
const TAXONOMY = {
  cities: [{ id: "city-1", name: "Austin", slug: "austin" }],
  categories: [{ id: "category-1", name: "Food & Drink", slug: "food-drink" }],
};
const ROWS = [{ name: "Local Cafe", city: "Austin", category: "Food & Drink" }];
const PROOF = { fileHash: HASH, revision: "7", taxonomyDigest: TAXONOMY_HASH };

function uploadRequest(path, { fields = {}, file, origin = ORIGIN, headers = {}, extraFiles = [] } = {}) {
  const form = new FormData();
  form.append("file", file || new File(["name,city,category\nLocal Cafe,Austin,Food & Drink"], "businesses.csv", { type: "text/csv" }));
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  for (const extraFile of extraFiles) form.append("file", extraFile);
  return new Request(`${ORIGIN}/api/admin/other-businesses/${path}`, {
    method: "POST", headers: { ...(origin === null ? {} : { origin }), ...headers }, body: form,
  });
}

beforeEach(() => {
  mocks.getCurrentUser.mockResolvedValue(ADMIN);
  mocks.getImportTaxonomy.mockResolvedValue(TAXONOMY);
  mocks.exportImportedBusinesses.mockResolvedValue(ROWS);
  mocks.createBusinessSpreadsheet.mockResolvedValue(Buffer.from("spreadsheet"));
  mocks.previewImportedBusinesses.mockResolvedValue({
    ...PROOF, revision: 7, canPublish: true, issues: [], issueCount: 0, rows: ROWS,
    summary: { total: 1, added: 1, changed: 0, removed: 0, unchanged: 0, hidden: 0 },
  });
  mocks.publishImportedBusinesses.mockResolvedValue({ revision: 8, total: 1, lastFileName: "businesses.csv" });
});

describe("other-businesses API access", () => {
  const routes = [
    ["preview", preview, () => uploadRequest("preview")],
    ["publish", publish, () => uploadRequest("publish", { fields: PROOF })],
    ["template", template, () => new Request(`${ORIGIN}/api/admin/other-businesses/template`)],
    ["export", exportList, () => new Request(`${ORIGIN}/api/admin/other-businesses/export`)],
  ];

  it.each(routes)("requires login for %s", async (_name, handler, request) => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await handler(request());
    expect(response.status).toBe(401);
    expect((await response.json()).success).toBe(false);
    expect(mocks.getImportTaxonomy).not.toHaveBeenCalled();
    expect(mocks.previewImportedBusinesses).not.toHaveBeenCalled();
    expect(mocks.publishImportedBusinesses).not.toHaveBeenCalled();
    expect(mocks.exportImportedBusinesses).not.toHaveBeenCalled();
  });

  it.each(routes)("rejects managers and regular users for %s", async (_name, handler, request) => {
    for (const role of ["USER", "MANAGER", "COMPLIMENTARY"]) {
      mocks.getCurrentUser.mockResolvedValue({ ...ADMIN, role });
      expect((await handler(request())).status).toBe(403);
    }
    expect(mocks.createBusinessSpreadsheet).not.toHaveBeenCalled();
    expect(mocks.previewImportedBusinesses).not.toHaveBeenCalled();
    expect(mocks.publishImportedBusinesses).not.toHaveBeenCalled();
    expect(mocks.exportImportedBusinesses).not.toHaveBeenCalled();
  });

  it.each([null, "null", "https://other.example", `${ORIGIN}.evil.example`])("rejects write origin %s", async (origin) => {
    expect((await preview(uploadRequest("preview", { origin }))).status).toBe(403);
    expect((await publish(uploadRequest("publish", { origin, fields: PROOF }))).status).toBe(403);
    expect(mocks.previewImportedBusinesses).not.toHaveBeenCalled();
    expect(mocks.publishImportedBusinesses).not.toHaveBeenCalled();
  });
});

describe("other-businesses uploads", () => {
  it("passes the original uploaded file to preview and marks the response private", async () => {
    const response = await preview(uploadRequest("preview"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({ success: true, data: { canPublish: true, rows: ROWS } });
    const file = mocks.previewImportedBusinesses.mock.calls[0][0];
    expect(file.name).toBe("businesses.csv");
    expect(await file.text()).toContain("Local Cafe,Austin,Food & Drink");
    expect(mocks.publishImportedBusinesses).not.toHaveBeenCalled();
  });

  it("publishes with the exact preview proof and authenticated admin", async () => {
    const response = await publish(uploadRequest("publish", { fields: PROOF }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { revision: 8, total: 1 } });
    expect(mocks.publishImportedBusinesses).toHaveBeenCalledWith(expect.any(File), {
      fileHash: HASH, revision: 7, taxonomyDigest: TAXONOMY_HASH,
    }, ADMIN);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it.each([
    {}, { ...PROOF, revision: "" }, { ...PROOF, revision: "-1" }, { ...PROOF, revision: "7x" },
    { ...PROOF, revision: "9007199254740992" }, { ...PROOF, fileHash: "different" },
    { ...PROOF, taxonomyDigest: "" },
  ])("requires complete valid preview proof: %j", async (fields) => {
    expect((await publish(uploadRequest("publish", { fields }))).status).toBe(400);
    expect(mocks.publishImportedBusinesses).not.toHaveBeenCalled();
  });

  it.each([
    ["empty", new File([], "empty.csv"), 400],
    ["wrong extension", new File(["test"], "businesses.xls"), 400],
    ["oversize", new File([new Uint8Array(3 * 1024 * 1024 + 1)], "businesses.xlsx"), 413],
  ])("rejects an %s file before parsing", async (_name, file, status) => {
    expect((await preview(uploadRequest("preview", { file }))).status).toBe(status);
    expect(mocks.previewImportedBusinesses).not.toHaveBeenCalled();
  });

  it("rejects multiple files and oversized request metadata", async () => {
    const multiple = uploadRequest("preview", { extraFiles: [new File(["data"], "extra.csv")] });
    expect((await preview(multiple)).status).toBe(400);
    const oversized = uploadRequest("preview", { headers: { "content-length": String(4 * 1024 * 1024) } });
    expect((await preview(oversized)).status).toBe(413);
    expect(mocks.previewImportedBusinesses).not.toHaveBeenCalled();
  });

  it("reports malformed multipart uploads without invoking the parser", async () => {
    const request = new Request(`${ORIGIN}/api/admin/other-businesses/preview`, {
      method: "POST", headers: { origin: ORIGIN, "content-type": "multipart/form-data; boundary=missing" }, body: "invalid",
    });
    expect((await preview(request)).status).toBe(400);
    expect(mocks.previewImportedBusinesses).not.toHaveBeenCalled();
  });

  it("bounds streamed request bodies even without content-length", async () => {
    const request = new Request(`${ORIGIN}/api/admin/other-businesses/preview`, {
      method: "POST", headers: { origin: ORIGIN, "content-type": "multipart/form-data; boundary=test" },
      body: new Uint8Array(3 * 1024 * 1024 + 64 * 1024 + 1),
    });
    expect(request.headers.has("content-length")).toBe(false);
    expect((await preview(request)).status).toBe(413);
    expect(mocks.previewImportedBusinesses).not.toHaveBeenCalled();
  });

  it("preserves conflict and row-validation errors without publishing", async () => {
    mocks.publishImportedBusinesses.mockRejectedValueOnce(Object.assign(new Error("The list changed. Preview again."), { status: 409 }));
    const conflict = await publish(uploadRequest("publish", { fields: PROOF }));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ success: false, error: "The list changed. Preview again." });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    const issues = [{ row: 2, field: "city", message: "Unknown city." }];
    mocks.previewImportedBusinesses.mockRejectedValueOnce(Object.assign(new Error("Fix the spreadsheet."), { status: 400, issues }));
    expect(await (await preview(uploadRequest("preview"))).json()).toEqual({ success: false, error: "Fix the spreadsheet.", issues });
  });

  it("does not expose unexpected internal errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.previewImportedBusinesses.mockRejectedValueOnce(new Error("database secret details"));
    const response = await preview(uploadRequest("preview"));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("database secret details");
  });
});

describe("other-businesses downloads", () => {
  it.each(["xlsx", "csv"])("downloads a %s template with current taxonomy", async (format) => {
    const response = await template(new Request(`${ORIGIN}/api/admin/other-businesses/template?format=${format}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(`template.${format}`);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.createBusinessSpreadsheet).toHaveBeenCalledWith({ format, ...TAXONOMY, rows: [] });
    expect(mocks.exportImportedBusinesses).not.toHaveBeenCalled();
    expect(await response.text()).toBe("spreadsheet");
  });

  it.each(["xlsx", "csv"])("exports all stored rows as %s without public-result filtering", async (format) => {
    const response = await exportList(new Request(`${ORIGIN}/api/admin/other-businesses/export?format=${format}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(`current.${format}`);
    expect(mocks.createBusinessSpreadsheet).toHaveBeenCalledWith({ format, ...TAXONOMY, rows: ROWS });
    expect(mocks.exportImportedBusinesses).toHaveBeenCalledTimes(1);
  });

  it("rejects unsupported download formats", async () => {
    expect((await template(new Request(`${ORIGIN}/api/admin/other-businesses/template?format=xls`))).status).toBe(400);
    expect((await exportList(new Request(`${ORIGIN}/api/admin/other-businesses/export?format=pdf`))).status).toBe(400);
    expect(mocks.createBusinessSpreadsheet).not.toHaveBeenCalled();
  });
});
