import { describe, expect, it } from "vitest";

import {
  isFavorableEventDisputeStatus,
  isTerminalEventDisputeStatus,
} from "@/lib/event-disputes";

describe("event dispute status classification", () => {
  it.each(["won", "warning_closed", "prevented"])(
    "treats %s as a favorable terminal status",
    (status) => {
      expect(isTerminalEventDisputeStatus(status)).toBe(true);
      expect(isFavorableEventDisputeStatus(status)).toBe(true);
    },
  );

  it("treats a lost dispute as terminal and unfavorable", () => {
    expect(isTerminalEventDisputeStatus("lost")).toBe(true);
    expect(isFavorableEventDisputeStatus("lost")).toBe(false);
  });

  it.each([
    "needs_response",
    "under_review",
    "warning_needs_response",
    "warning_under_review",
  ])("treats %s as open", (status) => {
    expect(isTerminalEventDisputeStatus(status)).toBe(false);
    expect(isFavorableEventDisputeStatus(status)).toBe(false);
  });
});
