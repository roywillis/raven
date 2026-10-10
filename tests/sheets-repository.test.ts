import { beforeEach, describe, expect, it } from "vitest";
import { SheetsApiError, SheetsClient } from "@/data/sheets/client";
import { SheetSchemaError } from "@/data/sheets/header-map";
import { APPLICATION_COLUMNS, REVIEW_COLUMNS, USER_COLUMNS } from "@/data/sheets/schema";
import { SheetsRepository } from "@/data/sheets/sheets-repository";
import { FakeSheets } from "./fake-sheets";
import { makeReview } from "./helpers";

const TABS = { applications: "applications", reviews: "raven_reviews", users: "raven_users" };

function appRow(values: Record<string, string | number>) {
  return APPLICATION_COLUMNS.map((column) => values[column] ?? "");
}

const anton = {
  borrower_id: "BOR-0026", nik: "3578010101900020", borrower_name: "Anton Gunawan", business_name: "Distributor Sayur",
  business_type: "Pertanian", province: "Jawa Timur", city: "Surabaya", tenor_months: 12,
  monthly_income_idr: 90000000, loan_amount_granted: 250000000, application_status: "BORDERLINE_HITL",
  pd_score: 0.1, decision_notes: "Moderate risk.",
};

let sheets: FakeSheets;
let repo: SheetsRepository;
let clock = 0;

beforeEach(() => {
  sheets = new FakeSheets({
    applications: [[...APPLICATION_COLUMNS], appRow(anton), appRow({ ...anton, borrower_id: "BOR-0099", pd_score: "n/a" })],
    // Reviews tab with columns in a different order than REVIEW_COLUMNS.
    raven_reviews: [[...REVIEW_COLUMNS].reverse()],
    raven_users: [
      [...USER_COLUMNS],
      ["Analyst@Raven.id", "Ana", "analyst", "TRUE"],
      ["viewer@raven.id", "", "Viewer", true],
      ["bad@raven.id", "Bad", "admin", "TRUE"],
    ],
  });
  const client = new SheetsClient({ spreadsheetId: "sheet-1", getAccessToken: async () => "token", fetch: sheets.fetch, retryDelayMs: 0 });
  clock = 0;
  repo = new SheetsRepository(client, TABS, () => clock);
});

describe("SheetsRepository", () => {
  it("reads applications and reports unparseable rows instead of failing", async () => {
    const snapshot = await repo.listApplications();
    expect(snapshot.applications).toHaveLength(1);
    expect(snapshot.applications[0]).toMatchObject({ borrower_id: "BOR-0026", pd_score: 0.1, borderline_final_review_status: "" });
    expect(snapshot.errors).toEqual(["applications row 3 (BOR-0099): pd_score is not a number."]);
  });

  it("does not need credit_score, and ignores a leftover credit_score column", async () => {
    expect(APPLICATION_COLUMNS).not.toContain("credit_score");
    sheets.tabs.applications = [
      [...APPLICATION_COLUMNS, "credit_score"],
      [...appRow(anton), ""],
    ];
    const snapshot = await repo.listApplications();
    expect(snapshot.errors).toEqual([]);
    expect(snapshot.applications[0]).not.toHaveProperty("credit_score");
  });

  it("fails with a schema error when the master tab lacks Raven's columns", async () => {
    sheets.tabs.applications[0] = APPLICATION_COLUMNS.filter((column) => column !== "review_id");
    await expect(repo.listApplications()).rejects.toThrow(SheetSchemaError);
  });

  it("appends a review in the log tab's own column order, as RAW values", async () => {
    const review = makeReview({ remarks: "=HYPERLINK(\"http://x\")" });
    await repo.appendReview(review);
    const appended = sheets.tabs.raven_reviews[1];
    expect(appended[0]).toBe(review.tenor_months);
    expect(appended.at(-1)).toBe("rev-1");
    expect((await repo.listReviews())[0]).toEqual(review);
    expect(sheets.requests.find((request) => request.url.includes(":append"))?.url).toContain("valueInputOption=RAW");
  });

  it("updates only Raven's columns on the borrower's master row, idempotently", async () => {
    const before = [...sheets.tabs.applications[1]];
    const review = makeReview();
    await repo.markApplicationReviewed(review);
    await repo.markApplicationReviewed(review);
    const after = sheets.tabs.applications[1];
    const col = (name: string) => APPLICATION_COLUMNS.indexOf(name as (typeof APPLICATION_COLUMNS)[number]);
    expect(after[col("borderline_final_review_status")]).toBe("APPROVED_HITL");
    expect(after[col("reviewed_by")]).toBe("analyst@raven.local");
    expect(after[col("review_id")]).toBe("rev-1");
    for (const column of ["loan_amount_granted", "tenor_months", "application_status", "decision_notes", "nik"]) {
      expect(after[col(column)]).toEqual(before[col(column)]);
    }
  });

  it("refuses to update when the borrower is missing or duplicated", async () => {
    await expect(repo.markApplicationReviewed(makeReview({ borrower_id: "BOR-404" }))).rejects.toThrow(/found 0/);
    sheets.tabs.applications.push(appRow(anton));
    await expect(repo.markApplicationReviewed(makeReview())).rejects.toThrow(/found 2/);
  });

  it("loads users case-insensitively, skips invalid roles, and caches for a minute", async () => {
    expect(await repo.findUser("analyst@raven.id")).toEqual({ email: "analyst@raven.id", display_name: "Ana", role: "analyst", active: true });
    expect(await repo.findUser("VIEWER@raven.id")).toMatchObject({ role: "viewer", display_name: "viewer@raven.id" });
    expect(await repo.findUser("bad@raven.id")).toBeNull();
    const reads = sheets.requests.length;
    sheets.tabs.raven_users.push(["new@raven.id", "New", "analyst", "TRUE"]);
    expect(await repo.findUser("new@raven.id")).toBeNull();
    expect(sheets.requests.length).toBe(reads);
    clock = 61_000;
    expect(await repo.findUser("new@raven.id")).not.toBeNull();
  });
});

describe("SheetsClient", () => {
  it("retries transient errors, then surfaces a SheetsApiError", async () => {
    sheets.failNext = [503];
    await expect(repo.listReviews()).resolves.toEqual([]);
    sheets.failNext = [500, 500, 500];
    await expect(repo.listReviews()).rejects.toBeInstanceOf(SheetsApiError);
  });

  it("does not retry client errors", async () => {
    sheets.failNext = [403];
    await expect(repo.listReviews()).rejects.toMatchObject({ status: 403 });
    expect(sheets.requests).toHaveLength(1);
  });
});
