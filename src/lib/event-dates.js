export const DEFAULT_EVENT_TIME_ZONE = "America/Chicago";
export const ALLOWED_EVENT_TIME_ZONES = Object.freeze([
  "America/Chicago",
  "America/Denver",
]);
export const MAX_EVENT_CALENDAR_DAYS = 30;

const ALLOWED_TIME_ZONE_SET = new Set(ALLOWED_EVENT_TIME_ZONES);

function asValidDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKeyToUtcDate(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
  if (!match) return null;

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function utcDateToKey(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function getRangeDates(startDate, endDate) {
  const start = asValidDate(startDate);
  const suppliedEnd = asValidDate(endDate);
  const end = suppliedEnd && start && suppliedEnd >= start ? suppliedEnd : start;
  return { start, end };
}

export function isAllowedEventTimeZone(value) {
  return ALLOWED_TIME_ZONE_SET.has(String(value || "").trim());
}

export function normalizeEventTimeZone(value) {
  const candidate = String(value || "").trim();
  return isAllowedEventTimeZone(candidate) ? candidate : DEFAULT_EVENT_TIME_ZONE;
}

export function getEventTimeZone(eventOrTimeZone) {
  if (typeof eventOrTimeZone === "string") {
    return normalizeEventTimeZone(eventOrTimeZone);
  }

  return normalizeEventTimeZone(
    eventOrTimeZone?.timezone ?? eventOrTimeZone?.timeZone
  );
}

export function formatEventDateKey(value, timeZone = DEFAULT_EVENT_TIME_ZONE) {
  const date = asValidDate(value);
  if (!date) return "undated";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeEventTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : "undated";
}

export function getEventCalendarDayCount(
  startDate,
  endDate,
  timeZone = DEFAULT_EVENT_TIME_ZONE
) {
  const { start, end } = getRangeDates(startDate, endDate);
  if (!start) return 0;

  const startKey = formatEventDateKey(start, timeZone);
  const endKey = formatEventDateKey(end, timeZone);
  const startDay = dateKeyToUtcDate(startKey);
  const endDay = dateKeyToUtcDate(endKey);
  if (!startDay || !endDay || endDay < startDay) return 1;

  return Math.floor((endDay.getTime() - startDay.getTime()) / 86_400_000) + 1;
}

export function getInclusiveEventDateKeys(
  startDate,
  endDate,
  timeZone = DEFAULT_EVENT_TIME_ZONE,
  maxDays = MAX_EVENT_CALENDAR_DAYS
) {
  const { start, end } = getRangeDates(startDate, endDate);
  if (!start) return [];

  const startKey = formatEventDateKey(start, timeZone);
  const endKey = formatEventDateKey(end, timeZone);
  const startDay = dateKeyToUtcDate(startKey);
  const endDay = dateKeyToUtcDate(endKey);
  if (!startDay || !endDay || endDay < startDay) return [startKey];

  const safeMaxDays = Number.isFinite(maxDays)
    ? Math.max(1, Math.floor(maxDays))
    : MAX_EVENT_CALENDAR_DAYS;
  const dayCount = Math.min(
    safeMaxDays,
    Math.floor((endDay.getTime() - startDay.getTime()) / 86_400_000) + 1
  );

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(startDay);
    date.setUTCDate(startDay.getUTCDate() + index);
    return utcDateToKey(date);
  });
}

export function eventOccursOnDateKey(event, dateKey) {
  if (!dateKey || dateKey === "undated") return false;
  const timeZone = getEventTimeZone(event);
  return getInclusiveEventDateKeys(
    event?.startDate,
    event?.endDate,
    timeZone
  ).includes(dateKey);
}

export function formatEventTime(value, timeZone = DEFAULT_EVENT_TIME_ZONE) {
  const date = asValidDate(value);
  if (!date) return "Time TBD";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: normalizeEventTimeZone(timeZone),
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function getEventLocalHour(value, timeZone = DEFAULT_EVENT_TIME_ZONE) {
  const date = asValidDate(value);
  if (!date) return null;

  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizeEventTimeZone(timeZone),
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;

  const parsed = Number(hour);
  return Number.isInteger(parsed) ? parsed : null;
}

export function formatLongEventDate(value, timeZone = DEFAULT_EVENT_TIME_ZONE) {
  const date = asValidDate(value);
  if (!date) return "Date coming soon";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: normalizeEventTimeZone(timeZone),
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatEventDateRange(
  startDate,
  endDate,
  timeZone = DEFAULT_EVENT_TIME_ZONE,
  { compact = false } = {}
) {
  const { start, end } = getRangeDates(startDate, endDate);
  if (!start) return "Date coming soon";

  const zone = normalizeEventTimeZone(timeZone);
  const startKey = formatEventDateKey(start, zone);
  const endKey = formatEventDateKey(end, zone);
  const formatter = new Intl.DateTimeFormat("en-US", compact
    ? { timeZone: zone, month: "short", day: "numeric", year: "numeric" }
    : {
        timeZone: zone,
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });

  return startKey === endKey
    ? formatter.format(start)
    : `${formatter.format(start)} - ${formatter.format(end)}`;
}

export function isEventPast(event, now = new Date()) {
  const comparisonDate = asValidDate(now) || new Date();
  const end = asValidDate(event?.endDate) || asValidDate(event?.startDate);
  return Boolean(end && end < comparisonDate);
}

export function isPubliclyDiscoverableEvent(event, now = new Date()) {
  return event?.status === "PUBLISHED" && !isEventPast(event, now);
}

export function getPublicEventWhere(now = new Date()) {
  const cutoff = asValidDate(now) || new Date();

  return {
    status: "PUBLISHED",
    creator: { deletedAt: null },
    OR: [
      { endDate: { gte: cutoff } },
      { endDate: null, startDate: { gte: cutoff } },
    ],
  };
}
