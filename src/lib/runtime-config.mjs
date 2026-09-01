const BOOLEAN_FLAGS = Object.freeze({
  EVENT_POSTING_ENABLED: false,
  SUBSCRIPTION_INVOICE_EVENTS_ENABLED: false,
  PAST_DUE_ACCESS_ENABLED: false,
  BILLING_MUTATION_FENCE_ENABLED: false,
  COMPLIMENTARY_ROLE_MUTATIONS_ENABLED: false,
  BUSINESS_PHOTO_UPLOAD_V2_ENABLED: false,
  EVENT_IMAGE_UPLOAD_V2_ENABLED: false,
  RESUME_UPLOAD_V2_ENABLED: false,
  PUBLIC_MEDIA_READ_V2_ENABLED: false,
  RESUME_RETENTION_DELETE_ENABLED: false,
  LEGACY_BLOB_PROXY_ENABLED: true,
});

const RESERVED_BOOLEAN_DEFAULTS = Object.freeze({
  SUBSCRIPTION_INVOICE_EVENTS_ENABLED: false,
  PAST_DUE_ACCESS_ENABLED: false,
  BILLING_MUTATION_FENCE_ENABLED: false,
  BUSINESS_PHOTO_UPLOAD_V2_ENABLED: false,
  EVENT_IMAGE_UPLOAD_V2_ENABLED: false,
  RESUME_UPLOAD_V2_ENABLED: false,
  PUBLIC_MEDIA_READ_V2_ENABLED: false,
  RESUME_RETENTION_DELETE_ENABLED: false,
  LEGACY_BLOB_PROXY_ENABLED: true,
});

const IMPLEMENTED_CAPABILITIES = Object.freeze({
  billingMutationFence: false,
  productionEventPosting: false,
});

const RECONCILIATION_MODES = new Set(["off", "observe", "repair"]);
const RATE_LIMIT_MODES = new Set(["off", "observe", "enforce"]);
const CSP_MODES = new Set(["off", "report-only", "enforce"]);
const RUNTIME_ENVIRONMENTS = new Set([
  "development",
  "test",
  "preview",
  "production",
]);

function value(input) {
  return typeof input === "string" ? input.trim() : "";
}

function parseBooleanFlag(env, name, fallback) {
  const raw = value(env[name]).toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
}

function parseMode(env, name, allowed, fallback) {
  const raw = value(env[name]).toLowerCase();
  return allowed.has(raw) ? raw : fallback;
}

function stripeMode(input, livePrefix, testPrefix) {
  const configured = value(input);
  if (!configured) return null;
  if (configured.startsWith(livePrefix)) return "live";
  if (configured.startsWith(testPrefix)) return "test";
  return "unknown";
}

function validUrl(input, { requireHttps = false } = {}) {
  try {
    const url = new URL(input);
    return (!requireHttps || url.protocol === "https:") &&
      ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function postgresTarget(input) {
  try {
    const url = new URL(input);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) return null;

    const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
    if (!url.hostname || !database) return null;

    return {
      hostname: url.hostname.toLowerCase().replace(/-pooler(?=\.)/, ""),
      port: url.port || "5432",
      database,
    };
  } catch {
    return null;
  }
}

export function getRuntimeEnvironment(env = process.env) {
  const configured = value(env.TX_LOCALIST_ENV || env.VERCEL_ENV).toLowerCase();
  if (RUNTIME_ENVIRONMENTS.has(configured)) return configured;
  return env.NODE_ENV === "test" ? "test" : "development";
}

export function getRuntimeFeatureFlags(env = process.env) {
  return Object.freeze({
    eventPostingEnabled: parseBooleanFlag(
      env,
      "EVENT_POSTING_ENABLED",
      BOOLEAN_FLAGS.EVENT_POSTING_ENABLED,
    ),
    subscriptionInvoiceEventsEnabled: parseBooleanFlag(
      env,
      "SUBSCRIPTION_INVOICE_EVENTS_ENABLED",
      BOOLEAN_FLAGS.SUBSCRIPTION_INVOICE_EVENTS_ENABLED,
    ),
    pastDueAccessEnabled: parseBooleanFlag(
      env,
      "PAST_DUE_ACCESS_ENABLED",
      BOOLEAN_FLAGS.PAST_DUE_ACCESS_ENABLED,
    ),
    billingMutationFenceEnabled: parseBooleanFlag(
      env,
      "BILLING_MUTATION_FENCE_ENABLED",
      BOOLEAN_FLAGS.BILLING_MUTATION_FENCE_ENABLED,
    ),
    complimentaryRoleMutationsEnabled: parseBooleanFlag(
      env,
      "COMPLIMENTARY_ROLE_MUTATIONS_ENABLED",
      BOOLEAN_FLAGS.COMPLIMENTARY_ROLE_MUTATIONS_ENABLED,
    ),
    businessPhotoUploadV2Enabled: parseBooleanFlag(
      env,
      "BUSINESS_PHOTO_UPLOAD_V2_ENABLED",
      BOOLEAN_FLAGS.BUSINESS_PHOTO_UPLOAD_V2_ENABLED,
    ),
    eventImageUploadV2Enabled: parseBooleanFlag(
      env,
      "EVENT_IMAGE_UPLOAD_V2_ENABLED",
      BOOLEAN_FLAGS.EVENT_IMAGE_UPLOAD_V2_ENABLED,
    ),
    resumeUploadV2Enabled: parseBooleanFlag(
      env,
      "RESUME_UPLOAD_V2_ENABLED",
      BOOLEAN_FLAGS.RESUME_UPLOAD_V2_ENABLED,
    ),
    publicMediaReadV2Enabled: parseBooleanFlag(
      env,
      "PUBLIC_MEDIA_READ_V2_ENABLED",
      BOOLEAN_FLAGS.PUBLIC_MEDIA_READ_V2_ENABLED,
    ),
    resumeRetentionDeleteEnabled: parseBooleanFlag(
      env,
      "RESUME_RETENTION_DELETE_ENABLED",
      BOOLEAN_FLAGS.RESUME_RETENTION_DELETE_ENABLED,
    ),
    legacyBlobProxyEnabled: parseBooleanFlag(
      env,
      "LEGACY_BLOB_PROXY_ENABLED",
      BOOLEAN_FLAGS.LEGACY_BLOB_PROXY_ENABLED,
    ),
    eventPaymentReconciliationMode: parseMode(
      env,
      "EVENT_PAYMENT_RECONCILIATION_MODE",
      RECONCILIATION_MODES,
      "off",
    ),
    rateLimitMode: parseMode(env, "RATE_LIMIT_MODE", RATE_LIMIT_MODES, "observe"),
    cspMode: parseMode(env, "CSP_MODE", CSP_MODES, "report-only"),
  });
}

export function isEventPostingEnabled(env = process.env) {
  const flags = getRuntimeFeatureFlags(env);
  if (!flags.eventPostingEnabled) return false;

  const environment = getRuntimeEnvironment(env);
  if (environment === "production") {
    return IMPLEMENTED_CAPABILITIES.productionEventPosting;
  }

  return (
    value(env.TX_LOCALIST_DATABASE_ENV).toLowerCase() === environment &&
    stripeMode(env.STRIPE_SECRET_KEY, "sk_live_", "sk_test_") === "test" &&
    stripeMode(env.NEXT_PUBLIC_STRIPE_PK, "pk_live_", "pk_test_") === "test" &&
    value(env.STRIPE_WEBHOOK_SECRET).startsWith("whsec_") &&
    value(env.STRIPE_PRICE_EVENT_POST).startsWith("price_")
  );
}

export function isComplimentaryRoleMutationsEnabled(env = process.env) {
  const flags = getRuntimeFeatureFlags(env);
  return (
    IMPLEMENTED_CAPABILITIES.billingMutationFence &&
    flags.billingMutationFenceEnabled &&
    flags.complimentaryRoleMutationsEnabled
  );
}

export function assertComplimentaryRoleMutationEnabled(
  { fromRole, toRole },
  env = process.env,
) {
  const grantsComplimentary =
    fromRole !== "COMPLIMENTARY" && toRole === "COMPLIMENTARY";
  if (!grantsComplimentary || isComplimentaryRoleMutationsEnabled(env)) return;

  throw Object.assign(
    new Error(
      "Assigning the Complimentary role is temporarily disabled while billing safeguards are being deployed.",
    ),
    { code: "COMPLIMENTARY_ROLE_MUTATIONS_DISABLED" },
  );
}

export function validateRuntimeConfiguration(
  env = process.env,
  { environment = getRuntimeEnvironment(env) } = {},
) {
  const issues = [];
  const addIssue = (code, message) => issues.push({ code, message });
  const targetEnvironment = value(environment).toLowerCase();
  const environmentIsValid = RUNTIME_ENVIRONMENTS.has(targetEnvironment);

  if (!environmentIsValid) {
    addIssue(
      "INVALID_TARGET_ENVIRONMENT",
      "The validation target must be development, test, preview, or production.",
    );
  }

  const txLocalistEnvironment = value(env.TX_LOCALIST_ENV).toLowerCase();
  const vercelEnvironment = value(env.VERCEL_ENV).toLowerCase();
  for (const [name, configured] of [
    ["TX_LOCALIST_ENV", txLocalistEnvironment],
    ["VERCEL_ENV", vercelEnvironment],
  ]) {
    if (configured && !RUNTIME_ENVIRONMENTS.has(configured)) {
      addIssue(
        "INVALID_RUNTIME_ENVIRONMENT",
        `${name} must be development, test, preview, or production.`,
      );
    }
  }
  if (
    txLocalistEnvironment &&
    vercelEnvironment &&
    txLocalistEnvironment !== vercelEnvironment
  ) {
    addIssue(
      "RUNTIME_ENVIRONMENT_CONFLICT",
      "TX_LOCALIST_ENV and VERCEL_ENV must identify the same environment.",
    );
  }

  const declaredEnvironment = txLocalistEnvironment || vercelEnvironment;
  if (
    environmentIsValid &&
    RUNTIME_ENVIRONMENTS.has(declaredEnvironment) &&
    declaredEnvironment !== targetEnvironment
  ) {
    addIssue(
      "RUNTIME_ENVIRONMENT_MISMATCH",
      "The declared runtime environment does not match the validation target.",
    );
  }

  for (const [name] of Object.entries(BOOLEAN_FLAGS)) {
    const raw = value(env[name]).toLowerCase();
    if (raw && raw !== "true" && raw !== "false") {
      addIssue("INVALID_BOOLEAN_FLAG", `${name} must be exactly true or false.`);
    }
  }

  const modeChecks = [
    ["EVENT_PAYMENT_RECONCILIATION_MODE", RECONCILIATION_MODES],
    ["RATE_LIMIT_MODE", RATE_LIMIT_MODES],
    ["CSP_MODE", CSP_MODES],
  ];
  for (const [name, allowed] of modeChecks) {
    const raw = value(env[name]).toLowerCase();
    if (raw && !allowed.has(raw)) {
      addIssue("INVALID_MODE_FLAG", `${name} has an unsupported value.`);
    }
  }

  const secretMode = stripeMode(env.STRIPE_SECRET_KEY, "sk_live_", "sk_test_");
  const publishableMode = stripeMode(
    env.NEXT_PUBLIC_STRIPE_PK,
    "pk_live_",
    "pk_test_",
  );
  if (secretMode === "unknown") {
    addIssue("INVALID_STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY has an invalid prefix.");
  }
  if (publishableMode === "unknown") {
    addIssue(
      "INVALID_STRIPE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_STRIPE_PK has an invalid prefix.",
    );
  }
  if (secretMode && publishableMode && secretMode !== publishableMode) {
    addIssue(
      "STRIPE_MODE_MISMATCH",
      "Stripe secret and publishable keys belong to different modes.",
    );
  }

  const databaseEnvironment = value(env.TX_LOCALIST_DATABASE_ENV).toLowerCase();
  if (!databaseEnvironment) {
    addIssue(
      "MISSING_DATABASE_ENVIRONMENT",
      "TX_LOCALIST_DATABASE_ENV must identify the database deployment class.",
    );
  } else if (!RUNTIME_ENVIRONMENTS.has(databaseEnvironment)) {
    addIssue(
      "INVALID_DATABASE_ENVIRONMENT",
      "TX_LOCALIST_DATABASE_ENV must be development, test, preview, or production.",
    );
  } else if (environmentIsValid && databaseEnvironment !== targetEnvironment) {
    addIssue(
      "DATABASE_ENVIRONMENT_MISMATCH",
      "The database deployment class does not match the runtime environment.",
    );
  }

  const runtimeDatabaseUrl = value(env.DATABASE_URL);
  const migrationDatabaseUrl = value(env.DATABASE_URL_UNPOOLED);
  const runtimeDatabase = postgresTarget(runtimeDatabaseUrl);
  const migrationDatabase = postgresTarget(migrationDatabaseUrl);

  if (!runtimeDatabaseUrl) {
    addIssue(
      "MISSING_RUNTIME_DATABASE_URL",
      "DATABASE_URL is required for the application runtime.",
    );
  } else if (!runtimeDatabase) {
    addIssue(
      "INVALID_RUNTIME_DATABASE_URL",
      "DATABASE_URL must be a PostgreSQL connection URL.",
    );
  }
  if (migrationDatabaseUrl && !migrationDatabase) {
    addIssue(
      "INVALID_MIGRATION_DATABASE_URL",
      "DATABASE_URL_UNPOOLED must be a PostgreSQL connection URL.",
    );
  }
  if (targetEnvironment === "production") {
    if (!migrationDatabaseUrl) {
      addIssue(
        "MISSING_MIGRATION_DATABASE_URL",
        "DATABASE_URL_UNPOOLED is required for production migrations.",
      );
    }
  }
  if (
    runtimeDatabase &&
    migrationDatabase &&
    (runtimeDatabase.hostname !== migrationDatabase.hostname ||
      runtimeDatabase.port !== migrationDatabase.port ||
      runtimeDatabase.database !== migrationDatabase.database)
  ) {
    addIssue(
      "DATABASE_TARGET_MISMATCH",
      "DATABASE_URL and DATABASE_URL_UNPOOLED must target the same database.",
    );
  }

  if (targetEnvironment === "production") {
    if (!validUrl(value(env.NEXT_PUBLIC_SITE_URL), { requireHttps: true })) {
      addIssue(
        "INVALID_PRODUCTION_SITE_URL",
        "NEXT_PUBLIC_SITE_URL must be an HTTPS URL in production.",
      );
    }
    if (value(env.CRON_SECRET).length < 16) {
      addIssue("INVALID_CRON_SECRET", "CRON_SECRET must contain at least 16 characters.");
    }
    if (secretMode !== "live" || publishableMode !== "live") {
      addIssue("PRODUCTION_STRIPE_MODE", "Production must use live Stripe keys.");
    }
    if (!value(env.STRIPE_WEBHOOK_SECRET).startsWith("whsec_")) {
      addIssue(
        "INVALID_STRIPE_WEBHOOK_SECRET",
        "A Stripe webhook signing secret is required in production.",
      );
    }
    if (!value(env.STRIPE_PRICE_STARTER).startsWith("price_")) {
      addIssue(
        "INVALID_STARTER_PRICE",
        "A Stripe Starter Price ID is required in production.",
      );
    }
    if (!value(env.BLOB_READ_WRITE_TOKEN)) {
      addIssue("MISSING_BLOB_TOKEN", "The production Blob token is required.");
    }
  } else if (secretMode === "live" || publishableMode === "live") {
    addIssue(
      "LIVE_STRIPE_KEY_OUTSIDE_PRODUCTION",
      "Development, test, and preview environments must not use live Stripe keys.",
    );
  }

  const flags = getRuntimeFeatureFlags(env);
  for (const [name, expected] of Object.entries(RESERVED_BOOLEAN_DEFAULTS)) {
    if (parseBooleanFlag(env, name, BOOLEAN_FLAGS[name]) !== expected) {
      addIssue(
        "RESERVED_ROLLOUT_SWITCH",
        `${name} must remain ${expected} until its implementation phase lands.`,
      );
    }
  }
  if (flags.eventPaymentReconciliationMode !== "off") {
    addIssue(
      "RESERVED_RECONCILIATION_MODE",
      "EVENT_PAYMENT_RECONCILIATION_MODE must remain off until reconciliation is implemented.",
    );
  }
  if (flags.rateLimitMode === "enforce" || flags.cspMode === "enforce") {
    addIssue(
      "RESERVED_ENFORCEMENT_MODE",
      "Rate limiting and CSP cannot be enforced until their runtime implementations land.",
    );
  }
  if (flags.complimentaryRoleMutationsEnabled) {
    addIssue(
      "COMPLIMENTARY_ROLE_NOT_READY",
      "COMPLIMENTARY_ROLE_MUTATIONS_ENABLED must remain false until the billing mutation fence is implemented.",
    );
  }
  if (flags.eventPostingEnabled) {
    if (targetEnvironment === "production") {
      addIssue(
        "PRODUCTION_EVENT_POSTING_NOT_READY",
        "EVENT_POSTING_ENABLED must remain false in production until the event rollout gates pass.",
      );
    }
    if (!value(env.STRIPE_PRICE_EVENT_POST).startsWith("price_")) {
      addIssue(
        "INVALID_EVENT_PRICE",
        "STRIPE_PRICE_EVENT_POST is required when event posting is enabled.",
      );
    }
    if (
      !secretMode ||
      !publishableMode ||
      !value(env.STRIPE_WEBHOOK_SECRET).startsWith("whsec_")
    ) {
      addIssue(
        "EVENT_POSTING_STRIPE_INCOMPLETE",
        "Event posting requires Stripe and webhook configuration.",
      );
    }
  }

  return Object.freeze({
    ok: issues.length === 0,
    environment: targetEnvironment,
    stripeMode: secretMode,
    flags,
    issues: Object.freeze(issues),
  });
}
