import { get } from "@vercel/blob";

import { isPrivateBlobUrl } from "@/lib/blob";

export async function GET(request) {
  const sourceUrl = request.nextUrl.searchParams.get("url")?.trim();

  if (!sourceUrl) {
    return new Response("Missing blob url", { status: 400 });
  }

  if (!isPrivateBlobUrl(sourceUrl)) {
    return new Response("Invalid blob url", { status: 400 });
  }

  try {
    const blob = await get(sourceUrl, { access: "private" });

    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return new Response("Image not found", { status: 404 });
    }

    return new Response(blob.stream, {
      headers: {
        "Content-Type": blob.blob.contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("[blob-image] failed to read blob", error);
    return new Response("Failed to load image", { status: 500 });
  }
}
