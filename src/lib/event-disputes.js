export const FAVORABLE_EVENT_DISPUTE_STATUSES = Object.freeze([
  "prevented",
  "warning_closed",
  "won",
]);

export const TERMINAL_EVENT_DISPUTE_STATUSES = Object.freeze([
  "lost",
  ...FAVORABLE_EVENT_DISPUTE_STATUSES,
]);

const favorableStatuses = new Set(FAVORABLE_EVENT_DISPUTE_STATUSES);
const terminalStatuses = new Set(TERMINAL_EVENT_DISPUTE_STATUSES);

export function isFavorableEventDisputeStatus(status) {
  return favorableStatuses.has(status);
}

export function isTerminalEventDisputeStatus(status) {
  return terminalStatuses.has(status);
}
