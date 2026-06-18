import { getEventsTargetLandingHtml } from "../events-target/html";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    if (url.search) {
      return Response.redirect(new URL("/events", url), 308);
    }

    const html = await getEventsTargetLandingHtml();
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("[events] failed to read landing template", error);

    return new Response("Unable to load events page.", {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }
}
