import { del, put } from "@vercel/blob";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

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

async function cleanOldUnclaimedUploads(userId) {
  const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const staleUploads = await prisma.eventImageUpload.findMany({
    where: {
      userId,
      eventId: null,
      createdAt: { lt: staleBefore },
    },
    select: { id: true, url: true },
    take: 20,
  });

  for (const upload of staleUploads) {
    try {
      await del(upload.url, { token: process.env.BLOB_READ_WRITE_TOKEN });
      await prisma.eventImageUpload.delete({ where: { id: upload.id } });
    } catch (error) {
      console.error("[event-image-upload] stale upload cleanup failed:", error);
    }
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

    await cleanOldUnclaimedUploads(user.id);
    const safeFileName = sanitizeFileName(file.name || "event-image");
    const blobPath = `event-images/${user.id}/${Date.now()}-${safeFileName}`;
    const uploadedBlob = await put(blobPath, file, {
      access: "private",
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: file.type,
    });

    try {
      await prisma.eventImageUpload.create({
        data: {
          userId: user.id,
          url: uploadedBlob.url,
          pathname: uploadedBlob.pathname,
          contentType: file.type,
          sizeBytes: file.size,
        },
      });
    } catch (error) {
      await del(uploadedBlob.url, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => null);
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
    return Response.json(
      { success: false, message: "Event image upload failed. Please try again." },
      { status: 500 },
    );
  }
}

