import { revalidatePath } from "next/cache";
import { publishImportedBusinesses } from "@/lib/imported-businesses";
import { importErrorResponse, importJson, readImportProof, readImportUpload, requireImportAdmin } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  try {
    const admin = await requireImportAdmin(request, true);
    const { file, form } = await readImportUpload(request);
    const result = await publishImportedBusinesses(file, readImportProof(form), admin);
    revalidatePath("/", "layout");
    return importJson(result);
  } catch (error) {
    return importErrorResponse(error);
  }
}
