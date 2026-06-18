const PRIVATE_BLOB_HOST_SEGMENT = ".private.blob.vercel-storage.com";

export function isPrivateBlobUrl(value) {
  return typeof value === "string" && value.includes(PRIVATE_BLOB_HOST_SEGMENT);
}

export function getBlobImageUrl(value) {
  if (!value) return value;
  if (!isPrivateBlobUrl(value)) return value;

  const params = new URLSearchParams({ url: value });
  return `/api/blob-image?${params.toString()}`;
}
