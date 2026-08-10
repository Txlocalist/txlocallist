export function getSafeNextPath(value) {
  if (typeof value !== "string") return null;

  const candidate = value.trim();
  let decoded = candidate;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    return null;
  }

  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    decoded.startsWith("//") ||
    decoded.includes("\\") ||
    /[\u0000-\u001F]/.test(decoded)
  ) {
    return null;
  }

  try {
    const parsed = new URL(candidate, "https://txlocalist.invalid");
    return parsed.origin === "https://txlocalist.invalid"
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : null;
  } catch {
    return null;
  }
}

