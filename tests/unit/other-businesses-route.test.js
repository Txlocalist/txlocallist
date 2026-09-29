import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/imported-businesses", () => ({ searchImportedBusinesses: vi.fn() }));
import { searchImportedBusinesses } from "@/lib/imported-businesses";
import { GET } from "@/app/api/other-businesses/route";

describe("other businesses public API", () => {
  beforeEach(() => { vi.mocked(searchImportedBusinesses).mockReset(); });

  it("returns a separate uncached page with literal search parameters", async () => {
    const data = { total: 30, page: 2, pageSize: 25, hasMore: false, revision: 4,
      results: [{ id: "import1", name: "Café", city: { name: "Austin" }, category: { name: "Coffee" } }] };
    vi.mocked(searchImportedBusinesses).mockResolvedValue(data);
    const response = await GET(new Request("https://example.test/api/other-businesses?q=Caf%C3%A9&loc=Austin%2C+TX&category=coffee&page=2"));
    expect(await response.json()).toEqual({ success: true, data });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(searchImportedBusinesses).toHaveBeenCalledWith({ q: "Café", loc: "Austin, TX", category: "coffee", citySlug: "", page: "2" });
  });

  it("supports exact city scoping from direct category pages", async () => {
    vi.mocked(searchImportedBusinesses).mockResolvedValue({ results: [], total: 0 });
    await GET(new Request("https://example.test/api/other-businesses?citySlug=austin&category=coffee"));
    expect(searchImportedBusinesses).toHaveBeenCalledWith(expect.objectContaining({ citySlug: "austin", category: "coffee" }));
  });

  it("rejects oversized search inputs before querying", async () => {
    const response = await GET(new Request(`https://example.test/api/other-businesses?q=${"a".repeat(201)}`));
    expect(response.status).toBe(400);
    expect(searchImportedBusinesses).not.toHaveBeenCalled();
  });

  it.each([503, 500])("contains a %i failure without returning database internals", async (status) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(searchImportedBusinesses).mockRejectedValue(Object.assign(new Error("private database details"), { status }));
    const response = await GET(new Request("https://example.test/api/other-businesses"));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ success: false, error: "Other businesses could not be loaded. Please try again." });
  });
});
