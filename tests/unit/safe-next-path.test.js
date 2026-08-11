import { describe, expect, test } from "vitest";

import { getSafeNextPath } from "@/lib/auth/redirect";

describe("getSafeNextPath", () => {
  test.each([
    ["/dashboard/events/new", "/dashboard/events/new"],
    [" /dashboard/events/event_1?checkout=success#status ", "/dashboard/events/event_1?checkout=success#status"],
    ["/%65vents", "/%65vents"],
  ])("accepts an internal path: %s", (input, expected) => {
    expect(getSafeNextPath(input)).toBe(expected);
  });

  test.each([
    "https://evil.example/steal",
    "//evil.example/steal",
    "/%2f%2fevil.example/steal",
    "/\\evil.example/steal",
    "/%5cevil.example/steal",
    "/dashboard%0aLocation:https://evil.example",
    "/bad%encoding",
    "dashboard/events",
    "",
  ])("rejects an unsafe next path: %s", (input) => {
    expect(getSafeNextPath(input)).toBeNull();
  });
});
