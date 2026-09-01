import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

const EXPECTED_AMOUNT_CENTS = 1000;
const EXPECTED_CURRENCY = "usd";

function value(input) {
  return typeof input === "string" ? input.trim() : "";
}

function getArgument(name) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((entry) => entry.startsWith(prefix));
  return argument ? argument.slice(prefix.length).trim() : "";
}

function calendarDayCount(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate(),
  );
  const end = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate(),
  );
  return Math.round((end - start) / 86_400_000) + 1;
}

function check(id, condition, detail) {
  return { id, status: condition ? "PASS" : "FAIL", detail };
}

function format(checks) {
  return checks
    .map((entry) => `[${entry.status}] ${entry.id}: ${entry.detail}`)
    .join("\n");
}

async function run() {
  if (!process.argv.includes("--confirm-sandbox-readonly")) {
    throw new Error(
      "Refusing to query Stripe and the database without --confirm-sandbox-readonly.",
    );
  }

  const eventId = getArgument("event-id");
  if (!eventId) {
    throw new Error("Provide the acceptance event with --event-id=<id>.");
  }

  const stripeKey = value(process.env.STRIPE_SECRET_KEY);
  const databaseUrl = value(process.env.DATABASE_URL);
  if (process.env.NODE_ENV === "production" || !stripeKey.startsWith("sk_test_")) {
    throw new Error("This verifier only runs outside production with a Stripe test key.");
  }
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const [{ default: Stripe }, { PrismaNeon }, { PrismaClient }] =
    await Promise.all([
      import("stripe"),
      import("@prisma/adapter-neon"),
      import("@prisma/client"),
    ]);
  const stripe = new Stripe(stripeKey, {
    appInfo: { name: "tx-localist-sandbox-event-acceptance" },
  });
  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: databaseUrl }),
  });

  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        payments: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!event) throw new Error(`Event ${eventId} was not found.`);

    const payment = event.payments.find((entry) => entry.status === "PAID");
    if (!payment?.stripeCheckoutSessionId) {
      throw new Error(`Event ${eventId} has no paid Stripe Checkout session.`);
    }

    const session = await stripe.checkout.sessions.retrieve(
      payment.stripeCheckoutSessionId,
    );
    const stripeEvents = await stripe.events.list({
      limit: 100,
      types: [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
      ],
    });
    const deliveredEvent = stripeEvents.data.find(
      (entry) => entry.data?.object?.id === session.id,
    );
    const receipt = deliveredEvent
      ? await prisma.stripeWebhookEvent.findUnique({
          where: { id: deliveredEvent.id },
        })
      : null;
    const dayCount = calendarDayCount(event.startDate, event.endDate);
    const sessionTax = session.total_details?.amount_tax ?? null;
    const checks = [
      check(
        "event.duration",
        dayCount === 30,
        `Inclusive calendar duration is ${dayCount ?? "unknown"} days.`,
      ),
      check(
        "event.posting_method",
        event.postingMethod === "ONE_TIME",
        `Posting method is ${event.postingMethod}.`,
      ),
      check(
        "event.review_status",
        event.status === "PENDING",
        `Event status is ${event.status}.`,
      ),
      check(
        "payment.status",
        payment.status === "PAID" && Boolean(payment.paidAt),
        `Payment status is ${payment.status}; paidAt is ${payment.paidAt ? "set" : "missing"}.`,
      ),
      check(
        "payment.base_amount",
        payment.amountCents === EXPECTED_AMOUNT_CENTS,
        `Base amount is ${payment.amountCents} cents.`,
      ),
      check(
        "payment.currency",
        payment.currency === EXPECTED_CURRENCY && session.currency === EXPECTED_CURRENCY,
        `Database/session currency is ${payment.currency}/${session.currency}.`,
      ),
      check(
        "payment.total",
        payment.chargedAmountCents === session.amount_total,
        `Database/session total is ${payment.chargedAmountCents}/${session.amount_total} cents.`,
      ),
      check(
        "payment.tax",
        payment.taxAmountCents === sessionTax,
        `Database/session tax is ${payment.taxAmountCents}/${sessionTax} cents.`,
      ),
      check(
        "stripe.payment",
        session.payment_status === "paid" && Boolean(session.payment_intent),
        `Checkout payment status is ${session.payment_status}; PaymentIntent is ${session.payment_intent ? "set" : "missing"}.`,
      ),
      check(
        "stripe.automatic_tax",
        session.automatic_tax?.enabled === true &&
          session.automatic_tax?.status === "complete",
        `Automatic Tax is ${session.automatic_tax?.enabled ? "enabled" : "disabled"} with status ${session.automatic_tax?.status ?? "unknown"}.`,
      ),
      check(
        "stripe.metadata",
        session.metadata?.eventId === event.id &&
          session.metadata?.paymentId === payment.id &&
          session.metadata?.userId === event.creatorId,
        "Checkout metadata matches the event, paid payment, and creator.",
      ),
      check(
        "webhook.stripe_event",
        Boolean(deliveredEvent),
        deliveredEvent
          ? `Matched ${deliveredEvent.type} ${deliveredEvent.id}.`
          : "No matching Stripe completion event was found.",
      ),
      check(
        "webhook.receipt",
        Boolean(receipt?.processedAt) && !receipt?.lastError && receipt?.attempts >= 1,
        receipt
          ? `Receipt processed with ${receipt.attempts} attempt(s) and ${receipt.lastError ? "an error" : "no error"}.`
          : "No database webhook receipt was found.",
      ),
    ];

    console.log(format(checks));
    console.log("");
    console.log(
      `Result: ${checks.every((entry) => entry.status === "PASS") ? "PASS" : "FAIL"}`,
    );
    if (checks.some((entry) => entry.status === "FAIL")) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

const entryPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;
if (entryPath === import.meta.url) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
