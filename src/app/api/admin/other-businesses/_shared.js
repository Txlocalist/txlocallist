import { getCurrentUser } from "@/lib/auth/session";

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 64 * 1024;
const NO_CACHE_HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export function importRequestError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export async function requireImportAdmin(request, write = false) {
  const user = await getCurrentUser();
  if (!user) throw importRequestError("Sign in to manage other businesses.", 401);
  if (user.role !== "ADMIN") throw importRequestError("Administrator access is required.", 403);
  if (write) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      throw importRequestError("This request must come from this website. Refresh the page and try again.", 403);
    }
  }
  return user;
}

export async function readImportUpload(request) {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_REQUEST_BYTES) {
    throw importRequestError("Choose a spreadsheet that is 3 MB or smaller.", 413);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    throw importRequestError("Choose an Excel (.xlsx) or CSV file to upload.");
  }
  let form;
  try {
    if (!request.body) throw importRequestError("Choose an Excel (.xlsx) or CSV file to upload.");
    const reader = request.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_REQUEST_BYTES) {
          await reader.cancel().catch(() => {});
          throw importRequestError("Choose a spreadsheet that is 3 MB or smaller.", 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    form = await new Response(Buffer.concat(chunks, total), {
      headers: { "Content-Type": request.headers.get("content-type") },
    }).formData();
  } catch (error) {
    if (error?.status) throw error;
    throw importRequestError("The upload could not be read. Select the file again and retry.");
  }
  const files = [...form.values()].filter((value) => value instanceof File);
  const file = form.get("file");
  if (files.length !== 1 || form.getAll("file").length !== 1 || !(file instanceof File)) {
    throw importRequestError("Choose one Excel (.xlsx) or CSV file.");
  }
  if (file.size === 0) throw importRequestError("The selected file is empty.");
  if (file.size > MAX_FILE_BYTES) throw importRequestError("Choose a spreadsheet that is 3 MB or smaller.", 413);
  if (!/\.(xlsx|csv)$/i.test(file.name)) throw importRequestError("Use an Excel (.xlsx) or CSV file.");
  return { file, form };
}

export function readImportProof(form) {
  const fileHash = form.get("fileHash");
  const taxonomyDigest = form.get("taxonomyDigest");
  const revisionText = form.get("revision");
  if (typeof fileHash !== "string" || !/^[a-f0-9]{64}$/i.test(fileHash)
      || typeof taxonomyDigest !== "string" || !/^[a-f0-9]{64}$/i.test(taxonomyDigest)
      || typeof revisionText !== "string" || !/^\d+$/.test(revisionText)
      || !Number.isSafeInteger(Number(revisionText))) {
    throw importRequestError("Preview this spreadsheet again before publishing.");
  }
  return { fileHash, taxonomyDigest, revision: Number(revisionText) };
}

export function importJson(data) {
  return Response.json({ success: true, data }, { headers: NO_CACHE_HEADERS });
}

export function importErrorResponse(error) {
  const knownStatus = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599;
  if (!knownStatus) console.error("[other-businesses] Request failed:", error);
  return Response.json({
    success: false,
    error: knownStatus ? error.message : "The request could not be completed. Please try again.",
    ...(knownStatus && Array.isArray(error.issues) ? { issues: error.issues.slice(0, 100) } : {}),
  }, { status: knownStatus ? error.status : 500, headers: NO_CACHE_HEADERS });
}

export function downloadFormat(request) {
  const format = new URL(request.url).searchParams.get("format") || "xlsx";
  if (format !== "xlsx" && format !== "csv") throw importRequestError("Choose an Excel or CSV download.");
  return format;
}

export function spreadsheetResponse(buffer, format, type) {
  return new Response(new Uint8Array(buffer), { headers: {
    ...NO_CACHE_HEADERS,
    "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="tx-localist-import-businesses-${type}.${format}"`,
  } });
}
