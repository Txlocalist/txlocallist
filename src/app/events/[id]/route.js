import { getEventsTargetEventHtml } from "../../events-target/html";

export const dynamic = "force-dynamic";

export async function GET(_request, context) {
  const params = await context.params;

  try {
    const html = await getEventsTargetEventHtml(params.id);

    if (!html) {
      return new Response("Event not found.", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("[events] failed to load event detail", error);

    return new Response("Unable to load event page.", {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }
}
