import { searchImportedBusinesses } from "@/lib/imported-businesses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const filters = Object.fromEntries(["q", "loc", "category", "citySlug", "page"]
    .map((key) => [key, params.get(key) || ""]));
  if (Object.values(filters).some((value) => value.length > 200)) {
    return Response.json({ success: false, error: "Search values must be 200 characters or fewer." }, { status: 400 });
  }
  try {
    return Response.json({ success: true, data: await searchImportedBusinesses(filters) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[other businesses] Search failed:", error);
    return Response.json({ success: false, error: "Other businesses could not be loaded. Please try again." },
      { status: error.status === 503 ? 503 : 500 });
  }
}
