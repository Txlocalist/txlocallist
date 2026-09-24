import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ count: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { business: mocks } }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn(async () => null) }));

import { GET } from "@/app/api/search/route";

beforeEach(() => {
  mocks.count.mockResolvedValue(1);
  mocks.findMany.mockResolvedValue([{
    id: "hiring-business", name: "Town Cafe", isHiring: true,
    categories: [], tags: [], photos: [], _count: { jobs: 0 },
  }]);
});

describe("business hiring search", () => {
  it("accepts the hiring flag or active jobs while retaining other filters", async () => {
    const response = await GET({ nextUrl: new URL("http://localhost/api/search?jobs=1&q=cafe&loc=Austin&category=food") });
    expect(response.status).toBe(200);
    const { where, select } = mocks.findMany.mock.calls[0][0];
    expect(where.AND).toEqual([{
      OR: [{ isHiring: true }, { jobs: { some: { status: "ACTIVE" } } }],
    }]);
    expect(where.OR).toContainEqual({ name: { mode: "insensitive", contains: "cafe" } });
    expect(where.city.OR).toContainEqual({ slug: "austin" });
    expect(where.categories).toEqual({ some: { category: { slug: "food" } } });
    expect(where).toMatchObject({ status: "ACTIVE", deletedAt: null, publishedAt: { not: null } });
    expect(where.owner).toBeDefined();
    expect(mocks.count).toHaveBeenCalledWith({ where });
    expect(select.isHiring).toBe(true);
    expect((await response.json()).data.results[0]).toMatchObject({ isHiring: true, activeJobCount: 0 });
  });

  it("does not restrict ordinary searches to hiring businesses", async () => {
    await GET({ nextUrl: new URL("http://localhost/api/search") });
    const { where } = mocks.findMany.mock.calls[0][0];
    expect(where.AND).toBeUndefined();
    expect(where.jobs).toBeUndefined();
    expect(where.isHiring).toBeUndefined();
  });
});
