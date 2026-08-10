import { prisma } from "@/lib/prisma";

const PROCESSING_LEASE_MS = 5 * 60 * 1000;

function errorMessage(error) {
  return error instanceof Error ? error.message.slice(0, 1000) : "Unknown webhook error";
}

export async function processStripeWebhookOnce(stripeEvent, handler) {
  await prisma.stripeWebhookEvent.upsert({
    where: { id: stripeEvent.id },
    create: { id: stripeEvent.id, type: stripeEvent.type },
    update: {},
  });

  const staleBefore = new Date(Date.now() - PROCESSING_LEASE_MS);
  const claimed = await prisma.stripeWebhookEvent.updateMany({
    where: {
      id: stripeEvent.id,
      processedAt: null,
      OR: [
        { processingStartedAt: null },
        { processingStartedAt: { lt: staleBefore } },
      ],
    },
    data: {
      processingStartedAt: new Date(),
      attempts: { increment: 1 },
      lastError: null,
    },
  });

  if (claimed.count === 0) {
    const current = await prisma.stripeWebhookEvent.findUnique({
      where: { id: stripeEvent.id },
      select: { processedAt: true, processingStartedAt: true },
    });

    if (current?.processedAt) {
      return { handled: false, duplicate: true, inProgress: false };
    }

    return { handled: false, duplicate: false, inProgress: true };
  }

  try {
    await handler(stripeEvent);
    await prisma.stripeWebhookEvent.update({
      where: { id: stripeEvent.id },
      data: {
        processedAt: new Date(),
        processingStartedAt: null,
        lastError: null,
      },
    });
    return { handled: true, duplicate: false, inProgress: false };
  } catch (error) {
    await prisma.stripeWebhookEvent.update({
      where: { id: stripeEvent.id },
      data: {
        processingStartedAt: null,
        lastError: errorMessage(error),
      },
    }).catch(() => null);
    throw error;
  }
}
