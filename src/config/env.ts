/**
 * Server-side configuration. Values come from environment variables (for local development,
 * a git-ignored `.env.local`; see `.env.example`). Nothing secret is hardcoded here.
 *
 * Never import this module from client components: it reads credentials paths and IDs that
 * must stay on the server.
 */

export type DataSource = "fixture" | "sheets";

export interface SheetsConfig {
  spreadsheetId: string;
  applicationsTab: string;
  /** Path to a service-account JSON key. Required for write-back. */
  credentialsPath: string;
  /** Optional read-only API key; cannot be used for writes. */
  apiKey?: string;
}

export interface AppConfig {
  dataSource: DataSource;
  analystId: string;
  /** Present only when `dataSource === "sheets"`. */
  sheets?: SheetsConfig;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

type Env = Record<string, string | undefined>;

const DEFAULT_ANALYST_ID = "ANALYST_LOCAL_01";
const DEFAULT_APPLICATIONS_TAB = "Applications";

function read(env: Env, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function parseDataSource(raw: string | undefined): DataSource {
  if (raw === undefined) return "fixture";
  if (raw === "fixture" || raw === "sheets") return raw;
  throw new ConfigError(`RAVEN_DATA_SOURCE must be "fixture" or "sheets", got "${raw}".`);
}

/** Builds and validates the config. Fails fast when Sheets mode is selected but incomplete. */
export function loadConfig(env: Env = process.env): AppConfig {
  const dataSource = parseDataSource(read(env, "RAVEN_DATA_SOURCE"));
  const analystId = read(env, "RAVEN_ANALYST_ID") ?? DEFAULT_ANALYST_ID;

  if (dataSource === "fixture") {
    return { dataSource, analystId };
  }

  const spreadsheetId = read(env, "GOOGLE_SHEETS_SPREADSHEET_ID");
  const credentialsPath = read(env, "GOOGLE_APPLICATION_CREDENTIALS");
  const missing = [
    !spreadsheetId && "GOOGLE_SHEETS_SPREADSHEET_ID",
    !credentialsPath && "GOOGLE_APPLICATION_CREDENTIALS",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new ConfigError(
      `RAVEN_DATA_SOURCE=sheets requires: ${missing.join(", ")}. See .env.example.`,
    );
  }

  return {
    dataSource,
    analystId,
    sheets: {
      spreadsheetId: spreadsheetId!,
      credentialsPath: credentialsPath!,
      applicationsTab: read(env, "GOOGLE_SHEETS_APPLICATIONS_TAB") ?? DEFAULT_APPLICATIONS_TAB,
      apiKey: read(env, "GOOGLE_SHEETS_API_KEY"),
    },
  };
}
