import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const localFormat = "yyyy-MM-dd'T'HH:mm:ss";

function localStamp(date, timezone) {
  return new Date(`${formatInTimeZone(new Date(date), timezone, localFormat)}Z`);
}

function wallTimeToInstant(stamp, timezone) {
  const text = stamp.toISOString().slice(0, 19);
  const instant = fromZonedTime(text, timezone);
  // Skip a weekly occurrence whose wall-clock time disappears at spring DST.
  return formatInTimeZone(instant, timezone, localFormat) === text ? instant : null;
}

export function isRecurringEvent(event) {
  return event?.recurrence === "WEEKLY";
}

// Calculate by local calendar weeks, not 168 UTC hours, to preserve venue time
// across DST. Jump straight to the current week even for years-old series.
export function getEventOccurrences(event, { now = new Date(), limit = 1 } = {}) {
  if (!event?.startDate || !event?.endDate) return [];
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const cutoff = new Date(now);
  if (![start, end, cutoff].every((date) => Number.isFinite(date.getTime())) || end <= start) return [];
  if (!isRecurringEvent(event)) return end >= cutoff ? [{ startDate: start, endDate: end }] : [];
  const timezone = event.timezone || "America/Chicago";
  const localStart = localStamp(start, timezone);
  const localEnd = localStamp(end, timezone);
  const until = event.recurrenceUntil ? new Date(event.recurrenceUntil) : null;
  const firstWeek = Math.max(0, Math.floor((localStamp(cutoff, timezone) - localEnd) / WEEK_MS));
  const count = Math.min(54, Math.max(1, limit));
  const occurrences = [];
  // Extra candidates allow a skipped DST week and a just-ended occurrence.
  for (let week = firstWeek; week < firstWeek + count + 3; week++) {
    const occurrenceStart = wallTimeToInstant(new Date(+localStart + week * WEEK_MS), timezone);
    const occurrenceEnd = wallTimeToInstant(new Date(+localEnd + week * WEEK_MS), timezone);
    if (!occurrenceStart || !occurrenceEnd || occurrenceEnd <= occurrenceStart) continue;
    if (until && occurrenceEnd > until) break;
    if (occurrenceEnd < cutoff) continue;
    occurrences.push({ startDate: occurrenceStart, endDate: occurrenceEnd });
    if (occurrences.length === count) break;
  }
  return occurrences;
}

export function getNextEventOccurrence(event, now = new Date()) {
  return getEventOccurrences(event, { now })[0] || null;
}

export function getRecurrenceLabel(event) {
  if (!isRecurringEvent(event) || !event.startDate) return "";
  return `Every ${formatInTimeZone(new Date(event.startDate), event.timezone || "America/Chicago", "EEEE")}`;
}

export function getRecurrenceUntilInput(event) {
  if (!event.recurrenceUntil || !event.startDate || !event.endDate) return "";
  const zone = event.timezone || "America/Chicago";
  const finalStart = +localStamp(event.recurrenceUntil, zone) - (localStamp(event.endDate, zone) - localStamp(event.startDate, zone));
  return new Date(finalStart).toISOString().slice(0, 10);
}

export function validateEventRecurrence({ recurrence = "NONE", until = "", schedule, now = new Date() }) {
  if (!["NONE", "WEEKLY"].includes(recurrence)) throw new Error("Choose a valid repeat schedule.");
  if (recurrence === "NONE") return { recurrence, recurrenceUntil: null };
  const zone = schedule.timezone;
  const start = localStamp(schedule.startDate, zone);
  const end = localStamp(schedule.endDate, zone);
  if (end - start >= WEEK_MS) throw new Error("Each weekly occurrence must end before the next week starts.");
  let recurrenceUntil = null;
  if (until) {
    const day = new Date(`${until}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || !Number.isFinite(+day) || day.toISOString().slice(0, 10) !== until) {
      throw new Error("Choose a valid last occurrence date.");
    }
    if (day.getUTCDay() !== start.getUTCDay() || until < start.toISOString().slice(0, 10)) {
      throw new Error("The last occurrence must be on the same weekday as the first, on or after it.");
    }
    const finalStart = new Date(`${until}T${start.toISOString().slice(11)}`);
    recurrenceUntil = wallTimeToInstant(new Date(+finalStart + (end - start)), zone);
    if (!recurrenceUntil || !wallTimeToInstant(finalStart, zone)) throw new Error("The final occurrence falls in a daylight-saving time gap. Choose another week.");
  }
  const result = { recurrence, recurrenceUntil };
  if (!getNextEventOccurrence({ ...schedule, ...result }, now)) throw new Error("The recurring series must have an upcoming occurrence.");
  return result;
}
