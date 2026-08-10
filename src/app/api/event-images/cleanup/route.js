import { timingSafeEqual } from "node:crypto";

import { cleanupStaleEventImageUploads } from "@/lib/event-image-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasValidCronAuthorization(request, secret) {
  const authorization = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const receivedBytes = Buffer.from(authorization);
  const expectedBytes = Buffer.from(expected);
  return receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes);
}

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json(
      { success: false, message: "Event image cleanup is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!hasValidCronAuthorization(request, cronSecret)) {
    return Response.json(
      { success: false, message: "Unauthorized." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { success: false, message: "Blob cleanup is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await cleanupStaleEventImageUploads({
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return Response.json(
      { success: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[event-image-cleanup] cleanup failed:", error);
    return Response.json(
      { success: false, message: "Event image cleanup failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
