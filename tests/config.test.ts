import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "@/config/env";

describe("loadConfig", () => {
  it("defaults to the fixture data source with no environment set", () => {
    expect(loadConfig({})).toEqual({ dataSource: "fixture", analystId: "ANALYST_LOCAL_01" });
  });

  it("rejects an unknown data source", () => {
    expect(() => loadConfig({ RAVEN_DATA_SOURCE: "postgres" })).toThrow(ConfigError);
  });

  it("fails fast when sheets mode is missing the spreadsheet ID and credentials", () => {
    expect(() => loadConfig({ RAVEN_DATA_SOURCE: "sheets" })).toThrow(
      /GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_APPLICATION_CREDENTIALS/,
    );
  });

  it("builds the sheets config from the environment", () => {
    const config = loadConfig({
      RAVEN_DATA_SOURCE: "sheets",
      GOOGLE_SHEETS_SPREADSHEET_ID: "sheet-123",
      GOOGLE_APPLICATION_CREDENTIALS: "./secrets/key.json",
      RAVEN_ANALYST_ID: "ANALYST_SURABAYA_01",
    });
    expect(config).toEqual({
      dataSource: "sheets",
      analystId: "ANALYST_SURABAYA_01",
      sheets: {
        spreadsheetId: "sheet-123",
        credentialsPath: "./secrets/key.json",
        applicationsTab: "Applications",
        apiKey: undefined,
      },
    });
  });
});
