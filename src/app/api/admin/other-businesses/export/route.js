import { createBusinessSpreadsheet } from "@/lib/business-import-file";
import { exportImportedBusinesses, getImportTaxonomy } from "@/lib/imported-businesses";
import { downloadFormat, importErrorResponse, requireImportAdmin, spreadsheetResponse } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request) {
  try {
    await requireImportAdmin(request);
    const format = downloadFormat(request);
    const [taxonomy, rows] = await Promise.all([getImportTaxonomy(), exportImportedBusinesses()]);
    const buffer = await createBusinessSpreadsheet({ format, ...taxonomy, rows });
    return spreadsheetResponse(buffer, format, "current");
  } catch (error) {
    return importErrorResponse(error);
  }
}
