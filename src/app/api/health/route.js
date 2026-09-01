export const dynamic = "force-dynamic";

export async function GET() {
  const release = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local";

  return Response.json(
    {
      status: "ok",
      release,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
