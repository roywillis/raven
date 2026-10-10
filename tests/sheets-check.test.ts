import { describe, expect, it } from "vitest";
import { checkSheetsSetup, explainAccessError, formatReport } from "@/data/sheets/check";
import { SheetsApiError, SheetsClient } from "@/data/sheets/client";
import { APPLICATION_COLUMNS, REVIEW_COLUMNS, USER_COLUMNS } from "@/data/sheets/schema";
import { FakeSheets } from "./fake-sheets";

const TABS = { applications: "applications", reviews: "raven_reviews", users: "raven_users" };
const EMAIL = "sheets-writer@project.iam.gserviceaccount.com";

const app = (values: Record<string, string | number>) => {
  const row: Record<string, string | number> = {
    borrower_id: "BOR-1", nik: "3578010101900020", borrower_name: "Anton Gunawan", province: "Jawa Timur", city: "Surabaya",
    credit_score: 670, tenor_months: 12, monthly_income_idr: 1, loan_amount_granted: 1, pd_score: 0.1,
    application_status: "BORDERLINE_HITL", ...values,
  };
  return APPLICATION_COLUMNS.map((column) => row[column] ?? "");
};

function check(tabs: FakeSheets["tabs"]) {
  const sheets = new FakeSheets(tabs);
  const client = new SheetsClient({ spreadsheetId: "s", getAccessToken: async () => "t", fetch: sheets.fetch, retryDelayMs: 0 });
  return { sheets, run: () => checkSheetsSetup(client, TABS, EMAIL) };
}

describe("checkSheetsSetup", () => {
  it("passes a fully set-up sheet and summarises it", async () => {
    const { sheets, run } = check({
      applications: [[...APPLICATION_COLUMNS], app({}), app({ borrower_id: "BOR-2", application_status: "APPROVED_AUTO" })],
      raven_reviews: [[...REVIEW_COLUMNS]],
      raven_users: [[...USER_COLUMNS], ["ana@x.id", "Ana", "analyst", "TRUE"]],
    });
    const report = await run();
    expect(report.problems).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.applications).toEqual({ valid: 2, pending: 1, byStatus: { BORDERLINE_HITL: 1, APPROVED_AUTO: 1 } });
    expect(report.users).toEqual({ activeAnalysts: 1, activeViewers: 0, inactive: 0 });
    expect(sheets.requests.every((request) => request.method === "GET")).toBe(true);
  });

  it("reports empty header rows and missing tabs as problems", async () => {
    const report = await check({ applications: [[...APPLICATION_COLUMNS]], raven_reviews: [] }).run();
    expect(report.tabs.map((tab) => [tab.tab, tab.status])).toEqual([
      ["applications", "ok"],
      ["raven_reviews", "missing-columns"],
      ["raven_users", "missing-tab"],
    ]);
    expect(report.problems[0]).toBe(`Tab "raven_reviews" is missing column(s) in row 1: ${REVIEW_COLUMNS.join(", ")}.`);
    expect(report.problems[1]).toBe('Tab "raven_users" does not exist (existing tabs: applications, raven_reviews).');
  });

  it("still analyses workflow data when only Raven's columns are missing, and points at renamed headers", async () => {
    const workflow = APPLICATION_COLUMNS.slice(0, 14);
    const header = [...workflow, "Review status for BORDERLINE"];
    const row = app({}).slice(0, 14);
    const report = await check({
      applications: [header, [...row, ""]],
      raven_reviews: [[...REVIEW_COLUMNS]],
      raven_users: [[...USER_COLUMNS], ["ana@x.id", "Ana", "analyst", "TRUE"]],
    }).run();
    expect(report.problems).toEqual([
      'Tab "applications" is missing column(s) in row 1: borderline_final_review_status, reviewed_by, reviewed_at, review_remarks, review_id. Unrecognised header(s): "review status for borderline".',
    ]);
    expect(report.tabs[0].unknownColumns).toEqual(["review status for borderline"]);
    expect(report.applications).toEqual({ valid: 1, pending: 1, byStatus: { BORDERLINE_HITL: 1 } });
  });

  it("warns about data issues without printing personal data", async () => {
    const report = await check({
      applications: [
        [...APPLICATION_COLUMNS],
        app({}),
        app({}),
        app({ borrower_id: "BOR-3", city: "" }),
        app({ borrower_id: "BOR-4", application_status: "SCORING" }),
        app({ borrower_id: "BOR-5", pd_score: "n/a" }),
      ],
      raven_reviews: [[...REVIEW_COLUMNS]],
      raven_users: [[...USER_COLUMNS], ["v@x.id", "V", "viewer", "TRUE"], ["x@x.id", "X", "admin", "TRUE"]],
    }).run();
    expect(report.problems).toEqual(["No active analyst in raven_users: nobody can sign in to make decisions."]);
    expect(report.warnings).toEqual([
      "1 application row(s) cannot be read and will be hidden: applications row 6 (BOR-5): pd_score is not a number.",
      "application_status values Raven ignores: SCORING.",
      "Duplicate borrower_id rows (hidden until fixed): BOR-1.",
      "1 row(s) have an empty city (City filter cannot match them): BOR-3.",
      '1 raven_users row(s) ignored: email missing or role is not "analyst"/"viewer".',
    ]);
    const text = formatReport(report);
    expect(text).not.toContain("3578010101900020");
    expect(text).not.toContain("Anton");
  });
});

describe("explainAccessError", () => {
  it("explains permission and not-found errors", () => {
    expect(explainAccessError(new SheetsApiError(403, "x"), EMAIL)).toContain(`Share it with ${EMAIL} as Editor`);
    expect(explainAccessError(new SheetsApiError(404, "x"), EMAIL)).toContain("GOOGLE_SHEETS_SPREADSHEET_ID");
  });

  it("never echoes key material from auth errors", () => {
    const message = explainAccessError(new Error("bad -----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY----- here"), EMAIL);
    expect(message).not.toContain("abc");
    expect(message).toContain("[key]");
  });
});
