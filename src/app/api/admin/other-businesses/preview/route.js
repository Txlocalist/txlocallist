import { previewImportedBusinesses } from "@/lib/imported-businesses";
import { importErrorResponse, importJson, readImportUpload, requireImportAdmin } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  try {
    await requireImportAdmin(request, true);
    const { file } = await readImportUpload(request);
    return importJson(await previewImportedBusinesses(file));
  } catch (error) {
    return importErrorResponse(error);
  }
}
