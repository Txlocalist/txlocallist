export function isMissingPrismaTableError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message =
    typeof error.message === "string" ? error.message : String(error.message ?? "");

  return (
    error.code === "P2021" ||
    error.code === "P2022" ||
    message.includes("does not exist in the current database")
  );
}

export function isUnavailablePrismaRelationError(error, relationName) {
  if (isMissingPrismaTableError(error)) {
    return true;
  }

  if (!error || typeof error !== "object" || !relationName) {
    return false;
  }

  const message =
    typeof error.message === "string" ? error.message : String(error.message ?? "");
  const escapedRelationName = String(relationName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return [
    new RegExp("Unknown field `" + escapedRelationName + "`", "i"),
    new RegExp("Unknown argument `" + escapedRelationName + "`", "i"),
    new RegExp("Field [\"'`]" + escapedRelationName + "[\"'`] does not exist", "i"),
  ].some((pattern) => pattern.test(message));
}

export const phase3SchemaMessage =
  "Phase 3 needs the new Business schema in your database before this page can load live data.";

export const authSchemaMessage =
  "Authentication tables are not available in the current database yet.";
