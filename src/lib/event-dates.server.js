import { fromZonedTime } from "date-fns-tz";

import {
  MAX_EVENT_CALENDAR_DAYS,
  formatEventDateKey,
  getEventCalendarDayCount,
  getInclusiveEventDateKeys,
  isAllowedEventTimeZone,
} from "./event-dates.js";

const DATE_TIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export class EventDateValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "EventDateValidationError";
    this.code = code;
  }
}

function throwDateError(code, message) {
  throw new EventDateValidationError(code, message);
}

function normalizeLocalDateTime(value) {
  const input = String(value || "").trim();
  const match = DATE_TIME_LOCAL_PATTERN.exec(input);
  if (!match) {
    throwDateError(
      "EVENT_DATE_FORMAT_INVALID",
      "Enter a valid event date and time."
    );
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "00"] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));

  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    throwDateError(
      "EVENT_DATE_FORMAT_INVALID",
      "Enter a valid event date and time."
    );
  }

  return `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText}`;
}

function formatLocalDateTimeForComparison(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;

  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}`;
}

export function parseOrganizerDateTimeLocal(value, timeZone) {
  if (!isAllowedEventTimeZone(timeZone)) {
    throwDateError(
      "EVENT_TIMEZONE_INVALID",
      "Choose Central Time or Mountain Time."
    );
  }

  const localDateTime = normalizeLocalDateTime(value);
  const instant = fromZonedTime(localDateTime, timeZone);
  if (
    Number.isNaN(instant.getTime()) ||
    formatLocalDateTimeForComparison(instant, timeZone) !== localDateTime
  ) {
    throwDateError(
      "EVENT_DATE_DOES_NOT_EXIST",
      "That local time does not exist because of daylight saving time. Choose another time."
    );
  }

  return instant;
}

export function validateOrganizerEventDateRange({
  startDate: startDateValue,
  endDate: endDateValue,
  timeZone,
  now = new Date(),
  maxDays = MAX_EVENT_CALENDAR_DAYS,
}) {
  const startDate = parseOrganizerDateTimeLocal(startDateValue, timeZone);
  const endDate = parseOrganizerDateTimeLocal(endDateValue, timeZone);
  const nowDate = now instanceof Date ? now : new Date(now);
  const comparisonDate = Number.isNaN(nowDate.getTime()) ? new Date() : nowDate;
  const requestedDayLimit = Number(maxDays);
  const dayLimit = Number.isFinite(requestedDayLimit)
    ? Math.min(MAX_EVENT_CALENDAR_DAYS, Math.max(1, Math.floor(requestedDayLimit)))
    : MAX_EVENT_CALENDAR_DAYS;

  if (endDate <= startDate) {
    throwDateError(
      "EVENT_END_NOT_AFTER_START",
      "The event end time must be after the start time."
    );
  }

  if (endDate <= comparisonDate) {
    throwDateError(
      "EVENT_END_NOT_FUTURE",
      "The event must end in the future."
    );
  }

  const dayCount = getEventCalendarDayCount(startDate, endDate, timeZone);
  if (dayCount > dayLimit) {
    throwDateError(
      "EVENT_RANGE_TOO_LONG",
      `Events can span no more than ${dayLimit} calendar days.`
    );
  }

  const dateKeys = getInclusiveEventDateKeys(
    startDate,
    endDate,
    timeZone,
    dayLimit
  );

  if (
    dateKeys[0] !== formatEventDateKey(startDate, timeZone) ||
    dateKeys.length !== dayCount
  ) {
    throwDateError(
      "EVENT_DATE_RANGE_INVALID",
      "Enter a valid event date range."
    );
  }

  return {
    startDate,
    endDate,
    timezone: timeZone,
    dateKeys,
  };
}
