import { get } from "@vercel/blob";

import { getCurrentSession } from "@/lib/auth/session";
import { isPrivateBlobUrl } from "@/lib/blob";
import { prisma } from "@/lib/prisma";

function sanitizeFileName(fileName) {
  if (!fileName) return "resume";
  return fileName
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(_request, { params }) {
  const session = await getCurrentSession().catch(() => null);
  const user = session?.user ?? null;

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return new Response("Missing application id", { status: 400 });
  }

  const application = await prisma.businessApplication.findUnique({
    where: { id },
    include: {
      business: {
        select: { ownerId: true },
      },
    },
  });

  if (!application) {
    return new Response("Application not found", { status: 404 });
  }

  const canView =
    user.role === "ADMIN" || application.business.ownerId === user.id;

  if (!canView) {
    return new Response("Forbidden", { status: 403 });
  }

  const isPrivateBlob = isPrivateBlobUrl(application.resumeUrl);
  const access = isPrivateBlob ? "private" : "public";
  const blob = await get(application.resumeUrl, { access });

  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    return new Response("Resume not found", { status: 404 });
  }

  return new Response(blob.stream, {
    headers: {
      "Content-Type": blob.blob.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${sanitizeFileName(application.resumeFileName)}"`,
      "Cache-Control": "private, no-cache",
    },
  });
}
