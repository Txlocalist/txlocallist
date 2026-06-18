import { getEventsTargetResultsHtml } from "../../events-target/html";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const html = await getEventsTargetResultsHtml();
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("[events] failed to read results template", error);

    return new Response("Unable to load events results page.", {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }
}
