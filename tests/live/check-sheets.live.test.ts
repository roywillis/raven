import { expect, it } from "vitest";
import { loadSheetsConfig } from "@/config/env";
import { checkSheetsSetup, formatReport } from "@/data/sheets/check";
import { createSheetsClient } from "@/data/sheets/client";

/**
 * Read-only readiness check of the real spreadsheet. Needs GOOGLE_SHEETS_SPREADSHEET_ID and
 * GOOGLE_SERVICE_ACCOUNT_JSON (from .env.local or the environment). Writes nothing.
 */
it("live Google Sheet is ready for Raven", async () => {
  const config = loadSheetsConfig();
  const client = createSheetsClient(config.spreadsheetId, config.credentials);
  const report = await checkSheetsSetup(client, config.tabs, config.credentials.client_email);
  // Written directly so the report also shows when the check passes (Vitest hides passing tests' logs).
  process.stdout.write(`\n${formatReport(report)}\n\n`);
  expect(report.problems, "see the report above").toEqual([]);
});
