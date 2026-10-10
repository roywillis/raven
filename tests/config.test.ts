import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig, parseServiceAccount } from "@/config/env";
import { SECRET, SERVICE_ACCOUNT_JSON } from "./helpers";

const base = { NEXTAUTH_SECRET: SECRET, GOOGLE_OAUTH_CLIENT_ID: "id", GOOGLE_OAUTH_CLIENT_SECRET: "secret" };

describe("loadConfig", () => {
  it("defaults to fixture data with Google sign-in", () => {
    expect(loadConfig(base)).toEqual({
      dataSource: "fixture",
      sheets: undefined,
      auth: { secret: SECRET, google: { clientId: "id", clientSecret: "secret" }, devSignIn: false },
    });
  });

  it("requires a strong NEXTAUTH_SECRET", () => {
    expect(() => loadConfig({ ...base, NEXTAUTH_SECRET: undefined })).toThrow(ConfigError);
    expect(() => loadConfig({ ...base, NEXTAUTH_SECRET: "short" })).toThrow(/at least 32/);
  });

  it("requires Google OAuth credentials unless dev sign-in is on", () => {
    expect(() => loadConfig({ NEXTAUTH_SECRET: SECRET })).toThrow(/GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET/);
    expect(loadConfig({ NEXTAUTH_SECRET: SECRET, RAVEN_DEV_SIGNIN: "true" }).auth).toEqual({
      secret: SECRET,
      google: undefined,
      devSignIn: true,
    });
  });

  it("refuses dev sign-in in production or with real sheet data", () => {
    expect(() => loadConfig({ ...base, RAVEN_DEV_SIGNIN: "true", NODE_ENV: "production" })).toThrow(/RAVEN_DEV_SIGNIN/);
    expect(() =>
      loadConfig({
        ...base,
        RAVEN_DEV_SIGNIN: "true",
        RAVEN_DATA_SOURCE: "sheets",
        GOOGLE_SHEETS_SPREADSHEET_ID: "sheet-1",
        GOOGLE_SERVICE_ACCOUNT_JSON: SERVICE_ACCOUNT_JSON,
      }),
    ).toThrow(/RAVEN_DEV_SIGNIN/);
  });

  it("rejects an unknown data source", () => {
    expect(() => loadConfig({ ...base, RAVEN_DATA_SOURCE: "postgres" })).toThrow(ConfigError);
  });

  it("fails fast when sheets mode is incomplete", () => {
    expect(() => loadConfig({ ...base, RAVEN_DATA_SOURCE: "sheets" })).toThrow(
      /GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON/,
    );
  });

  it("builds the sheets config with default tab names", () => {
    const config = loadConfig({
      ...base,
      RAVEN_DATA_SOURCE: "sheets",
      GOOGLE_SHEETS_SPREADSHEET_ID: "sheet-1",
      GOOGLE_SERVICE_ACCOUNT_JSON: SERVICE_ACCOUNT_JSON,
    });
    expect(config.sheets).toMatchObject({
      spreadsheetId: "sheet-1",
      credentials: { client_email: "raven@project.iam.gserviceaccount.com" },
      tabs: { applications: "applications", reviews: "raven_reviews", users: "raven_users" },
    });
    expect(config.sheets?.credentials.private_key).toContain("\nabc\n");
  });
});

describe("parseServiceAccount", () => {
  it("accepts base64-encoded JSON", () => {
    const encoded = Buffer.from(SERVICE_ACCOUNT_JSON).toString("base64");
    expect(parseServiceAccount(encoded).client_email).toBe("raven@project.iam.gserviceaccount.com");
  });

  it("rejects invalid or incomplete keys", () => {
    expect(() => parseServiceAccount("{not json")).toThrow(ConfigError);
    expect(() => parseServiceAccount(JSON.stringify({ client_email: "x" }))).toThrow(/client_email and private_key/);
  });
});
