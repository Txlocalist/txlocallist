import { beforeEach, describe, expect, test, vi } from "vitest";

const webhookStore = vi.hoisted(() => {
  const rows = new Map();

  function project(row, select) {
    if (!row) return null;
    if (!select) return { ...row };

    return Object.fromEntries(
      Object.keys(select)
        .filter((key) => select[key])
        .map((key) => [key, row[key]]),
    );
  }

  const stripeWebhookEvent = {
    upsert: vi.fn(async ({ where, create }) => {
      const existing = rows.get(where.id);
      if (existing) return { ...existing };

      const created = {
        ...create,
        attempts: 0,
        processingStartedAt: null,
        processedAt: null,
        lastError: null,
      };
      rows.set(where.id, created);
      return { ...created };
    }),

    updateMany: vi.fn(async ({ where, data }) => {
      const row = rows.get(where.id);
      const staleBefore = where.OR?.find(
        (condition) => condition.processingStartedAt?.lt,
      )?.processingStartedAt.lt;
      const leaseAvailable = row && (
        row.processingStartedAt === null ||
        (staleBefore && row.processingStartedAt < staleBefore)
      );
      const claimable = Boolean(
        row &&
        row.processedAt === where.processedAt &&
        leaseAvailable
      );

      if (!claimable) return { count: 0 };

      rows.set(where.id, {
        ...row,
        ...data,
        attempts: row.attempts + (data.attempts?.increment ?? 0),
      });
      return { count: 1 };
    }),

    findUnique: vi.fn(async ({ where, select }) => (
      project(rows.get(where.id), select)
    )),

    update: vi.fn(async ({ where, data }) => {
      const row = rows.get(where.id);
      if (!row) throw new Error(`Missing webhook row ${where.id}`);

      const updated = { ...row, ...data };
      rows.set(where.id, updated);
      return { ...updated };
    }),
  };

  return { rows, stripeWebhookEvent };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    stripeWebhookEvent: webhookStore.stripeWebhookEvent,
  },
}));

import { processStripeWebhookOnce } from "@/lib/stripe-webhooks";

function stripeEvent(id = "evt_webhook_1") {
  return {
    id,
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_1" } },
  };
}

beforeEach(() => {
  webhookStore.rows.clear();
});

describe("processStripeWebhookOnce", () => {
  test("claims and processes a new Stripe event", async () => {
    const event = stripeEvent();
    const handler = vi.fn().mockResolvedValue(undefined);

    const result = await processStripeWebhookOnce(event, handler);

    expect(result).toEqual({
      handled: true,
      duplicate: false,
      inProgress: false,
    });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(event);

    const receipt = webhookStore.rows.get(event.id);
    expect(receipt).toMatchObject({
      id: event.id,
      type: event.type,
      attempts: 1,
      processingStartedAt: null,
      lastError: null,
    });
    expect(receipt.processedAt).toBeInstanceOf(Date);
  });

  test("does not invoke the handler for a processed replay", async () => {
    const event = stripeEvent("evt_duplicate");
    const firstHandler = vi.fn().mockResolvedValue(undefined);
    const replayHandler = vi.fn().mockResolvedValue(undefined);

    await processStripeWebhookOnce(event, firstHandler);
    const result = await processStripeWebhookOnce(event, replayHandler);

    expect(result).toEqual({
      handled: false,
      duplicate: true,
      inProgress: false,
    });
    expect(firstHandler).toHaveBeenCalledOnce();
    expect(replayHandler).not.toHaveBeenCalled();
    expect(webhookStore.rows.get(event.id).attempts).toBe(1);
  });

  test("persists a retryable handler error and succeeds on retry", async () => {
    const event = stripeEvent("evt_retry");
    const failure = new Error("Temporary downstream failure");
    const failingHandler = vi.fn().mockRejectedValue(failure);

    await expect(
      processStripeWebhookOnce(event, failingHandler),
    ).rejects.toBe(failure);

    expect(webhookStore.rows.get(event.id)).toMatchObject({
      attempts: 1,
      processedAt: null,
      processingStartedAt: null,
      lastError: failure.message,
    });

    const retryHandler = vi.fn().mockResolvedValue(undefined);
    const result = await processStripeWebhookOnce(event, retryHandler);

    expect(result).toEqual({
      handled: true,
      duplicate: false,
      inProgress: false,
    });
    expect(retryHandler).toHaveBeenCalledOnce();
    expect(webhookStore.rows.get(event.id)).toMatchObject({
      attempts: 2,
      processingStartedAt: null,
      lastError: null,
    });
    expect(webhookStore.rows.get(event.id).processedAt).toBeInstanceOf(Date);
  });
});
