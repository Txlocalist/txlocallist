const NON_REFUNDING_CANCELLATION_REASONS = new Set(["ORGANIZER", "ADMIN"]);

function sameInstant(left, right) {
  return left instanceof Date &&
    right instanceof Date &&
    left.getTime() === right.getTime();
}

export function shouldKeepSettledPaymentForCancelledEvent(event, payment) {
  return Boolean(
    event &&
    payment &&
    event.creatorId === payment.userId &&
    event.postingMethod === "ONE_TIME" &&
    event.status === "CANCELLED" &&
    NON_REFUNDING_CANCELLATION_REASONS.has(event.cancellationReason) &&
    sameInstant(event.startDate, payment.eventStartDate) &&
    sameInstant(event.endDate, payment.eventEndDate)
  );
}

export function canAdminRefundPaidEvent(event) {
  return Boolean(
    event?.status === "DENIED" ||
    (
      event?.status === "CANCELLED" &&
      event.cancellationReason === "PAYMENT_DISPUTE"
    )
  );
}
