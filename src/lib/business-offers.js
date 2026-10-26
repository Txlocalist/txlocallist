export const MAX_BUSINESS_OFFERS = 3;
export const OFFER_TIME_ZONE = "America/Chicago";
export const OFFER_LIMITS = Object.freeze({ headline: 100, description: 600, instructions: 400, code: 60, terms: 500 });

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: OFFER_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});

export function getOfferDateKey(now = new Date()) {
  const parts = dayFormatter.formatToParts(now);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type).value).join("-");
}

function validDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function normalizeBusinessOffers(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Enter a valid list of offers.");
  if (value.length > MAX_BUSINESS_OFFERS) throw new Error(`Add up to ${MAX_BUSINESS_OFFERS} offers per business.`);
  return value.map((offer, order) => {
    const prefix = `Offer ${order + 1}: `;
    if (!offer || typeof offer !== "object" || Array.isArray(offer)) throw new Error(prefix + "enter valid offer details.");
    const result = { order };
    for (const [field, limit] of Object.entries(OFFER_LIMITS)) {
      const raw = offer[field];
      if (raw != null && typeof raw !== "string") throw new Error(prefix + `enter valid ${field}.`);
      const text = (raw ?? "").trim();
      if (["headline", "description", "instructions"].includes(field) && !text) {
        throw new Error(prefix + `${field === "instructions" ? "redemption instructions" : field} is required.`);
      }
      if (text.length > limit) throw new Error(prefix + `${field} must be ${limit} characters or fewer.`);
      result[field] = text || null;
    }
    for (const field of ["startDate", "endDate"]) {
      const raw = offer[field];
      if (raw != null && raw !== "" && (typeof raw !== "string" || !validDateKey(raw))) {
        throw new Error(prefix + "choose valid calendar dates.");
      }
      result[field] = raw || null;
    }
    if (result.startDate && result.endDate && result.endDate < result.startDate) {
      throw new Error(prefix + "end date must be on or after the start date.");
    }
    if (offer.enabled !== undefined && typeof offer.enabled !== "boolean") throw new Error(prefix + "choose a valid visibility setting.");
    result.enabled = offer.enabled ?? true;
    return result;
  });
}

export function getOfferStatus(offer, today = getOfferDateKey()) {
  if (!offer.enabled) return "Paused";
  if (offer.endDate && offer.endDate < today) return "Expired";
  if (offer.startDate && offer.startDate > today) return "Scheduled";
  return "Active";
}

export function getActiveOffers(offers = [], today = getOfferDateKey()) {
  return offers.filter((offer) => getOfferStatus(offer, today) === "Active");
}

// Combine this relation predicate with getPublicBusinessWhere at public entrypoints.
// ISO calendar dates compare chronologically without assuming a 24-hour local day.
export function getActiveOfferWhere(today = getOfferDateKey()) {
  return {
    enabled: true,
    AND: [
      { OR: [{ startDate: null }, { startDate: { lte: today } }] },
      { OR: [{ endDate: null }, { endDate: { gte: today } }] },
    ],
  };
}

// Public search needs dates for saved filtering, but never unpublished coupon text.
export const OFFER_WINDOW_SELECT = Object.freeze({ enabled: true, startDate: true, endDate: true });

export function formatOfferDate(value) {
  if (!value || !validDateKey(value)) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })
    .format(new Date(`${value}T00:00:00Z`));
}
