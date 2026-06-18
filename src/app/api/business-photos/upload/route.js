import { put } from "@vercel/blob";

import { getCurrentUser } from "@/lib/auth/session";
import { getOwnerBillingState } from "@/lib/billing";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 20;

function sanitizeFileName(fileName) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { success: false, message: "Blob upload is not configured." },
      { status: 500 }
    );
  }

  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return Response.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  const billingState = await getOwnerBillingState(user.id).catch(() => null);
  if (user.role !== "ADMIN" && !billingState?.hasPaidAccess) {
    return Response.json(
      { success: false, message: "Upgrade to the paid plan before uploading photos." },
      { status: 403 }
    );
  }

  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value) => value instanceof File);

    if (files.length === 0) {
      return Response.json(
        { success: false, message: "No files were provided." },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
      return Response.json(
        { success: false, message: `You can upload up to ${MAX_FILES_PER_REQUEST} photos at once.` },
        { status: 400 }
      );
    }

    const uploaded = [];

    for (const file of files) {
      if (!file.type?.startsWith("image/")) {
        return Response.json(
          { success: false, message: "Only image uploads are supported." },
          { status: 400 }
        );
      }

      if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
        return Response.json(
          { success: false, message: "Each image must be 8MB or smaller." },
          { status: 400 }
        );
      }

      const safeFileName = sanitizeFileName(file.name || "photo");
      const blobPath = `business-photos/${user.id}/${Date.now()}-${safeFileName}`;

      const uploadedBlob = await put(blobPath, file, {
        access: "private",
        addRandomSuffix: true,
        token: process.env.BLOB_READ_WRITE_TOKEN,
        contentType: file.type,
      });

      uploaded.push({
        url: uploadedBlob.url,
        pathname: uploadedBlob.pathname,
        name: file.name,
        size: file.size,
        contentType: file.type,
      });
    }

    return Response.json({
      success: true,
      files: uploaded,
    });
  } catch (error) {
    console.error("[business-photo-upload] upload failed", error);

    return Response.json(
      {
        success: false,
        message:
          process.env.NODE_ENV === "development"
            ? `Photo upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
            : "Photo upload failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
