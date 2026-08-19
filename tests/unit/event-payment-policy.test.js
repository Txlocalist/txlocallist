import { describe, expect, it } from "vitest";

import {
  shouldKeepSettledPaymentForCancelledEvent,
} from "@/lib/event-payment-policy";

const startDate = new Date("2026-09-10T15:00:00.000Z");
const endDate = new Date("2026-09-12T23:00:00.000Z");
const payment = {
  userId: "user_1",
  eventStartDate: startDate,
  eventEndDate: endDate,
};
const event = {
  creatorId: "user_1",
  postingMethod: "ONE_TIME",
  status: "CANCELLED",
  cancellationReason: "ORGANIZER",
  startDate,
  endDate,
};

describe("one-time event payment policy", () => {
  it.each(["ORGANIZER", "ADMIN"])(
    "does not auto-refund a matching %s cancellation",
    (cancellationReason) => {
      expect(
        shouldKeepSettledPaymentForCancelledEvent(
          { ...event, cancellationReason },
          payment,
        ),
      ).toBe(true);
    },
  );

  it.each(["PAYMENT_REFUND", "PAYMENT_DISPUTE", null])(
    "does not suppress compensation for %s",
    (cancellationReason) => {
      expect(
        shouldKeepSettledPaymentForCancelledEvent(
          { ...event, cancellationReason },
          payment,
        ),
      ).toBe(false);
    },
  );

  it("requires the purchased schedule and owner to match", () => {
    expect(
      shouldKeepSettledPaymentForCancelledEvent(
        { ...event, endDate: new Date("2026-09-13T23:00:00.000Z") },
        payment,
      ),
    ).toBe(false);
    expect(
      shouldKeepSettledPaymentForCancelledEvent(event, {
        ...payment,
        userId: "user_2",
      }),
    ).toBe(false);
  });
});
