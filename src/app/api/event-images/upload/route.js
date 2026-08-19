import { randomUUID } from "node:crypto";

import { del, put } from "@vercel/blob";

import { getCurrentUser } from "@/lib/auth/session";
import {
  consumeEventImageUploadRateLimit,
  hasValidEventImageSignature,
} from "@/lib/event-image-uploads";
import { prisma } from "@/lib/prisma";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function sanitizeFileName(fileName) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "event-image";
}

function compactError(error) {
  return error instanceof Error
    ? error.message.slice(0, 500)
    : "Unknown upload cleanup error";
}

async function discardReservedUpload(uploadId, pathname, error) {
  try {
    await del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
    await prisma.eventImageUpload.deleteMany({
      where: { id: uploadId, eventId: null },
    });
  } catch (cleanupError) {
    await prisma.eventImageUpload.updateMany({
      where: { id: uploadId, eventId: null },
      data: {
        cleanupError: compactError(cleanupError ?? error),
        cleanupStartedAt: null,
      },
    }).catch(() => null);
  }
}

export async function POST(request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { success: false, message: "Event image upload is not configured." },
      { status: 503 },
    );
  }

  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return Response.json(
      { success: false, message: "Sign in before uploading an event image." },
      { status: 401 },
    );
  }

  try {
    const rateLimit = await consumeEventImageUploadRateLimit(user.id);
    if (!rateLimit.allowed) {
      return Response.json(
        {
          success: false,
          message: "Too many event image uploads. Wait before trying again.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files").filter((value) => value instanceof File);

    if (files.length !== 1) {
      return Response.json(
        { success: false, message: "Choose exactly one event image." },
        { status: 400 },
      );
    }

    const file = files[0];
    if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
      return Response.json(
        { success: false, message: "Event images must be JPG, PNG, or WEBP files." },
        { status: 400 },
      );
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json(
        { success: false, message: "The event image must be 8MB or smaller." },
        { status: 400 },
      );
    }
    if (!(await hasValidEventImageSignature(file))) {
      return Response.json(
        { success: false, message: "The selected file is not a valid JPG, PNG, or WEBP image." },
        { status: 400 },
      );
    }

    const safeFileName = sanitizeFileName(file.name || "event-image");
    const uploadId = randomUUID();
    const blobPath = `event-images/${user.id}/${uploadId}-${safeFileName}`;
    const pendingUrl = `pending:event-image:${uploadId}`;
    await prisma.eventImageUpload.create({
      data: {
        id: uploadId,
        userId: user.id,
        url: pendingUrl,
        pathname: blobPath,
        contentType: file.type,
        sizeBytes: file.size,
      },
    });

    let uploadedBlob;
    try {
      uploadedBlob = await put(blobPath, file, {
        access: "private",
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
        contentType: file.type,
      });
      const ready = await prisma.eventImageUpload.updateMany({
        where: {
          id: uploadId,
          userId: user.id,
          eventId: null,
          url: pendingUrl,
          readyAt: null,
          cleanupStartedAt: null,
        },
        data: {
          url: uploadedBlob.url,
          pathname: uploadedBlob.pathname,
          readyAt: new Date(),
        },
      });
      if (ready.count !== 1) {
        throw new Error("The event image upload reservation changed before it was ready.");
      }
    } catch (error) {
      await discardReservedUpload(
        uploadId,
        uploadedBlob?.pathname ?? blobPath,
        error,
      );
      throw error;
    }

    return Response.json({
      success: true,
      files: [{
        url: uploadedBlob.url,
        pathname: uploadedBlob.pathname,
        name: file.name,
        size: file.size,
        contentType: file.type,
      }],
    });
  } catch (error) {
    console.error("[event-image-upload] upload failed:", error);
    if (isMissingPrismaTableError(error)) {
      return Response.json(
        {
          success: false,
          message:
            "Event image uploads are temporarily unavailable while a database update is applied. Please try again after deployment.",
        },
        { status: 503 },
      );
    }
    return Response.json(
      { success: false, message: "Event image upload failed. Please try again." },
      { status: 500 },
    );
  }
}

