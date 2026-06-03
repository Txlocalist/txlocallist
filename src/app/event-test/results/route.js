import { getEventTestResultsHtml } from "../html";

export const dynamic = "force-static";

export async function GET() {
  try {
    const html = await getEventTestResultsHtml();
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("[event-test/results] failed to load results page", error);
    return new Response("Unable to load event-test results page.", {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }
}
