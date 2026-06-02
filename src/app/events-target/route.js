import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-static";

export async function GET() {
  const sourcePath = path.join(
    process.cwd(),
    "Brandons HTML",
    "tx-localist-events-landing (3).html"
  );

  try {
    const html = await fs.readFile(sourcePath);

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
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
