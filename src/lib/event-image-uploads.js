import { del } from "@vercel/blob";

import { prisma } from "@/lib/prisma";

export const EVENT_IMAGE_UPLOAD_LIMIT = 10;
export const EVENT_IMAGE_UPLOAD_WINDOW_MS = 60 * 60 * 1000;
export const EVENT_IMAGE_UPLOAD_STALE_MS = 24 * 60 * 60 * 1000;

const CLEANUP_LEASE_MS = 15 * 60 * 1000;
const MAX_CLEANUP_BATCH = 100;
const EVENT_IMAGE_UPLOAD_CLAIM_ERROR = "EVENT_IMAGE_UPLOAD_CLAIM_FAILED";

function compactError(error) {
  return error instanceof Error
    ? error.message.slice(0, 500)
    : "Unknown Blob deletion error";
}

function claimError(message) {
  return Object.assign(new Error(message), {
    code: EVENT_IMAGE_UPLOAD_CLAIM_ERROR,
  });
}

function normalizeBatchLimit(limit) {
  if (!Number.isFinite(limit)) return 50;
  return Math.max(1, Math.min(MAX_CLEANUP_BATCH, Math.trunc(limit)));
}

export function isEventImageUploadClaimError(error) {
  return error?.code === EVENT_IMAGE_UPLOAD_CLAIM_ERROR;
}

export async function hasValidEventImageSignature(file) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/jpeg") {
    return bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;
  }
  if (file.type === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((value, index) => bytes[index] === value);
  }
  if (file.type === "image/webp") {
    return bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

export async function consumeEventImageUploadRateLimit(
  userId,
  { now = new Date() } = {},
) {
  const windowCutoff = new Date(now.getTime() - EVENT_IMAGE_UPLOAD_WINDOW_MS);

  return prisma.$transaction(async (tx) => {
    await tx.eventImageUploadRateLimit.upsert({
      where: { userId },
      create: {
        userId,
        windowStartedAt: now,
        attempts: 0,
      },
      update: {},
    });

    await tx.eventImageUploadRateLimit.updateMany({
      where: {
        userId,
        windowStartedAt: { lte: windowCutoff },
      },
      data: {
        windowStartedAt: now,
        attempts: 0,
      },
    });

    const consumed = await tx.eventImageUploadRateLimit.updateMany({
      where: {
        userId,
        windowStartedAt: { gt: windowCutoff },
        attempts: { lt: EVENT_IMAGE_UPLOAD_LIMIT },
      },
      data: { attempts: { increment: 1 } },
    });
    const state = await tx.eventImageUploadRateLimit.findUnique({
      where: { userId },
      select: { attempts: true, windowStartedAt: true },
    });

    if (!state) {
      throw new Error("The event image upload rate limit could not be recorded.");
    }

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (state.windowStartedAt.getTime() + EVENT_IMAGE_UPLOAD_WINDOW_MS - now.getTime()) /
          1000,
      ),
    );
    return {
      allowed: consumed.count === 1,
      remaining: Math.max(0, EVENT_IMAGE_UPLOAD_LIMIT - state.attempts),
      retryAfterSeconds,
    };
  });
}

export async function claimEventImageUpload(
  tx,
  { uploadId, userId, eventId, now = new Date() },
) {
  const claimed = await tx.eventImageUpload.updateMany({
    where: {
      id: uploadId,
      userId,
      readyAt: { not: null },
      cleanupStartedAt: null,
      OR: [
        { eventId: null },
        { eventId },
      ],
    },
    data: {
      eventId,
      claimedAt: now,
      cleanupError: null,
    },
  });

  if (claimed.count !== 1) {
    throw claimError(
      "The selected event image expired or is no longer available. Upload it again.",
    );
  }
}

export async function replaceEventImageUpload(
  tx,
  { eventId, userId, uploadId = null, now = new Date() },
) {
  const replaced = await tx.eventImageUpload.findMany({
    where: {
      eventId,
      ...(uploadId ? { id: { not: uploadId } } : {}),
    },
    select: { id: true },
  });
  const replacedIds = replaced.map((upload) => upload.id);

  if (replacedIds.length > 0) {
    const unclaimed = await tx.eventImageUpload.updateMany({
      where: {
        id: { in: replacedIds },
        eventId,
      },
      data: {
        eventId: null,
        claimedAt: null,
        cleanupError: null,
      },
    });
    if (unclaimed.count !== replacedIds.length) {
      throw claimError("The event image changed concurrently. Reload and try again.");
    }
  }

  if (uploadId) {
    await claimEventImageUpload(tx, { uploadId, userId, eventId, now });
  }

  return replacedIds;
}

async function deleteTrackedUpload(upload, { now, staleBefore, token }) {
  const staleLeaseBefore = new Date(now.getTime() - CLEANUP_LEASE_MS);
  const acquired = await prisma.eventImageUpload.updateMany({
    where: {
      id: upload.id,
      eventId: null,
      ...(staleBefore ? { createdAt: { lt: staleBefore } } : {}),
      OR: [
        { cleanupStartedAt: null },
        { cleanupStartedAt: { lt: staleLeaseBefore } },
      ],
    },
    data: {
      cleanupStartedAt: now,
      cleanupAttempts: { increment: 1 },
      cleanupError: null,
    },
  });
  if (acquired.count !== 1) return "skipped";

  try {
    await del(upload.pathname, { token });
    const removed = await prisma.eventImageUpload.deleteMany({
      where: {
        id: upload.id,
        eventId: null,
        cleanupStartedAt: now,
      },
    });
    return removed.count === 1 ? "deleted" : "skipped";
  } catch (error) {
    await prisma.eventImageUpload.updateMany({
      where: {
        id: upload.id,
        eventId: null,
        cleanupStartedAt: now,
      },
      data: {
        cleanupStartedAt: null,
        cleanupError: compactError(error),
      },
    }).catch(() => null);
    return "failed";
  }
}

async function deleteUploadBatch(uploads, options) {
  const result = {
    selected: uploads.length,
    deleted: 0,
    failed: 0,
    skipped: 0,
  };

  for (const upload of uploads) {
    const outcome = await deleteTrackedUpload(upload, options);
    result[outcome] += 1;
  }

  return result;
}

export async function cleanupStaleEventImageUploads({
  now = new Date(),
  limit = 50,
  token = process.env.BLOB_READ_WRITE_TOKEN,
} = {}) {
  if (!token) throw new Error("Blob storage is not configured.");

  const staleBefore = new Date(now.getTime() - EVENT_IMAGE_UPLOAD_STALE_MS);
  const staleLeaseBefore = new Date(now.getTime() - CLEANUP_LEASE_MS);
  const uploads = await prisma.eventImageUpload.findMany({
    where: {
      eventId: null,
      createdAt: { lt: staleBefore },
      OR: [
        { cleanupStartedAt: null },
        { cleanupStartedAt: { lt: staleLeaseBefore } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: normalizeBatchLimit(limit),
    select: { id: true, pathname: true },
  });

  return deleteUploadBatch(uploads, { now, staleBefore, token });
}

export async function cleanupEventImageUploadsByIds(
  uploadIds,
  {
    now = new Date(),
    token = process.env.BLOB_READ_WRITE_TOKEN,
  } = {},
) {
  const ids = [...new Set(uploadIds)].slice(0, MAX_CLEANUP_BATCH);
  if (ids.length === 0) {
    return { selected: 0, deleted: 0, failed: 0, skipped: 0 };
  }
  if (!token) throw new Error("Blob storage is not configured.");

  const uploads = await prisma.eventImageUpload.findMany({
    where: {
      id: { in: ids },
      eventId: null,
    },
    select: { id: true, pathname: true },
  });
  return deleteUploadBatch(uploads, { now, staleBefore: null, token });
}
