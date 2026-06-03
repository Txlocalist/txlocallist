import { getEventsTargetLandingHtml } from "./html";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const html = await getEventsTargetLandingHtml();
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("[events-target] failed to read landing template", error);

    return new Response("Unable to load events-target landing page.", {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }
}
