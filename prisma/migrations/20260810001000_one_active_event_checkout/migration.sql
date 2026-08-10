-- A Stripe idempotency key is derived from EventPayment.id, so competing requests
-- must first converge on one active ledger row for the event.
DO $$
DECLARE
    duplicate_event_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO duplicate_event_count
    FROM (
        SELECT "eventId"
        FROM "EventPayment"
        WHERE "status" IN ('CREATED', 'PROCESSING')
        GROUP BY "eventId"
        HAVING COUNT(*) > 1
    ) AS duplicate_events;

    IF duplicate_event_count > 0 THEN
        RAISE EXCEPTION USING
            MESSAGE = 'Cannot enforce one active event Checkout while duplicate attempts exist.',
            DETAIL = format('%s event(s) have multiple CREATED/PROCESSING payments.', duplicate_event_count),
            HINT = 'Keep EVENT_POSTING_ENABLED=false, run the launch-runbook preflight query, reconcile or expire every corresponding Stripe Session, then retry this migration.';
    END IF;
END $$;

CREATE UNIQUE INDEX "EventPayment_one_active_checkout_per_event"
ON "EventPayment"("eventId")
WHERE "status" IN ('CREATED', 'PROCESSING');
