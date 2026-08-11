import { describe, expect, it } from "vitest";

import {
  DEFAULT_BUSINESS_SEARCH_PAGE_SIZE,
  MAX_BUSINESS_SEARCH_PAGE_SIZE,
  getBusinessSearchPageSize,
} from "@/lib/business-search";

describe("getBusinessSearchPageSize", () => {
  it("keeps the existing page size when no limit is requested", () => {
    expect(getBusinessSearchPageSize(null)).toBe(DEFAULT_BUSINESS_SEARCH_PAGE_SIZE);
    expect(getBusinessSearchPageSize("not-a-number")).toBe(DEFAULT_BUSINESS_SEARCH_PAGE_SIZE);
  });

  it("allows the initial results page to request 15 businesses", () => {
    expect(getBusinessSearchPageSize("15")).toBe(15);
  });

  it("clamps requested limits to the safe range", () => {
    expect(getBusinessSearchPageSize("0")).toBe(1);
    expect(getBusinessSearchPageSize("100")).toBe(MAX_BUSINESS_SEARCH_PAGE_SIZE);
  });
});
