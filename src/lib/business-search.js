export const DEFAULT_BUSINESS_SEARCH_PAGE_SIZE = 12;
export const MAX_BUSINESS_SEARCH_PAGE_SIZE = 15;

export function getBusinessSearchPageSize(value) {
  const requestedSize = Number.parseInt(value, 10);

  if (!Number.isFinite(requestedSize)) {
    return DEFAULT_BUSINESS_SEARCH_PAGE_SIZE;
  }

  return Math.min(
    MAX_BUSINESS_SEARCH_PAGE_SIZE,
    Math.max(1, requestedSize)
  );
}
