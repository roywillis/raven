/**
 * Server-side configuration. Values come from environment variables (for local development,
 * a git-ignored `.env.local`; see `.env.example`). Nothing secret is hardcoded here.
 *
 * Never import this module from client components.
 */

export type DataSource = "fixture" | "sheets";

export interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

export interface SheetsConfig {
  spreadsheetId: string;
  credentials: ServiceAccountCredentials;
  tabs: {
    applications: string;
    reviews: string;
    users: string;
  };
}

export interface AuthConfig {
  secret: string;
  /** Google sign-in for analysts. Absent only when dev sign-in is used locally. */
  google?: { clientId: string; clientSecret: string };
  /** Local-only sign-in as a fixture user. Never enabled in production or sheets mode. */
  devSignIn: boolean;
}

export interface AppConfig {
  dataSource: DataSource;
  /** Present only when `dataSource === "sheets"`. */
  sheets?: SheetsConfig;
  auth: AuthConfig;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

type Env = Record<string, string | undefined>;

const MIN_SECRET_LENGTH = 32;

function read(env: Env, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function parseDataSource(raw: string | undefined): DataSource {
  if (raw === undefined) return "fixture";
  if (raw === "fixture" || raw === "sheets") return raw;
  throw new ConfigError(`RAVEN_DATA_SOURCE must be "fixture" or "sheets", got "${raw}".`);
}

/**
 * Parses the service-account key from `GOOGLE_SERVICE_ACCOUNT_JSON`, given either as raw JSON
 * or base64-encoded JSON (useful on hosts that mangle newlines in env vars).
 */
export function parseServiceAccount(raw: string): ServiceAccountCredentials {
  const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ConfigError("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON (raw or base64).");
  }
  const { client_email, private_key } = (parsed ?? {}) as Record<string, unknown>;
  if (typeof client_email !== "string" || typeof private_key !== "string" || !private_key.includes("PRIVATE KEY")) {
    throw new ConfigError("GOOGLE_SERVICE_ACCOUNT_JSON must contain client_email and private_key.");
  }
  return { client_email, private_key: private_key.replace(/\\n/g, "\n") };
}

function requireAll(env: Env, keys: string[], context: string): void {
  const missing = keys.filter((key) => !read(env, key));
  if (missing.length > 0) {
    throw new ConfigError(`${context} requires: ${missing.join(", ")}. See .env.example.`);
  }
}

/** Loads only the Google Sheets settings (used by the app and by `npm run check:sheets`). */
export function loadSheetsConfig(env: Env = process.env): SheetsConfig {
  requireAll(env, ["GOOGLE_SHEETS_SPREADSHEET_ID", "GOOGLE_SERVICE_ACCOUNT_JSON"], "RAVEN_DATA_SOURCE=sheets");
  return {
    spreadsheetId: read(env, "GOOGLE_SHEETS_SPREADSHEET_ID")!,
    credentials: parseServiceAccount(read(env, "GOOGLE_SERVICE_ACCOUNT_JSON")!),
    tabs: {
      applications: read(env, "RAVEN_TAB_APPLICATIONS") ?? "applications",
      reviews: read(env, "RAVEN_TAB_REVIEWS") ?? "raven_reviews",
      users: read(env, "RAVEN_TAB_USERS") ?? "raven_users",
    },
  };
}

function loadAuth(env: Env, dataSource: DataSource): AuthConfig {
  const secret = read(env, "NEXTAUTH_SECRET");
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new ConfigError(
      `NEXTAUTH_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters (generate one with: openssl rand -base64 32).`,
    );
  }

  const devSignIn = read(env, "RAVEN_DEV_SIGNIN") === "true";
  if (devSignIn && (env.NODE_ENV === "production" || dataSource !== "fixture")) {
    throw new ConfigError("RAVEN_DEV_SIGNIN is only allowed with RAVEN_DATA_SOURCE=fixture outside production.");
  }

  const clientId = read(env, "GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = read(env, "GOOGLE_OAUTH_CLIENT_SECRET");
  if (!devSignIn) {
    requireAll(env, ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"], "Google sign-in");
  }
  const google = clientId && clientSecret ? { clientId, clientSecret } : undefined;

  return { secret, google, devSignIn };
}

/** Builds and validates the config. Fails fast on missing or unsafe settings. */
export function loadConfig(env: Env = process.env): AppConfig {
  const dataSource = parseDataSource(read(env, "RAVEN_DATA_SOURCE"));
  return {
    dataSource,
    sheets: dataSource === "sheets" ? loadSheetsConfig(env) : undefined,
    auth: loadAuth(env, dataSource),
  };
}

let cached: AppConfig | undefined;

/** Process-wide config, loaded on first use (not at build time). */
export function getConfig(): AppConfig {
  cached ??= loadConfig();
  return cached;
}
