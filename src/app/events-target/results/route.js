import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  url.pathname = "/events/results";
  return NextResponse.redirect(url, 308);
}
