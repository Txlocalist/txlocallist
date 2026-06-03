export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const destination = new URL("/results", url.origin);

  destination.searchParams.set("tab", "events");

  for (const [key, value] of url.searchParams.entries()) {
    if (key === "tab") continue;
    destination.searchParams.set(key, value);
  }

  return Response.redirect(destination, 307);
}
