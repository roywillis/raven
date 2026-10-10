import type { SheetsConfig } from "@/config/env";
import { findDuplicateBorrowers } from "@/domain/review";
import { AUTO_APPROVED_STATUS, AUTO_DECLINED_STATUS, PENDING_STATUS } from "@/domain/status";
import type { RavenUser, SheetApplication } from "@/domain/types";
import { SheetsApiError, type SheetsClient } from "./client";
import { parseTable, quoteTab, type SheetTable } from "./header-map";
import {
  APPLICATION_COLUMNS,
  parseApplication,
  parseReview,
  parseUser,
  REVIEW_COLUMNS,
  USER_COLUMNS,
  WORKFLOW_COLUMNS,
} from "./schema";

/**
 * Read-only readiness check of the live spreadsheet (`npm run check:sheets`). Reports what is
 * missing or inconsistent without writing anything and without printing personal data.
 */

export type TabRole = "applications" | "reviews" | "users";

export interface TabReport {
  role: TabRole;
  tab: string;
  status: "ok" | "missing-tab" | "missing-columns";
  missingColumns: string[];
  /** Header names Raven does not use (often a misspelt required column). */
  unknownColumns: string[];
  rows: number;
}

export interface SheetsCheckReport {
  spreadsheetTitle: string | null;
  tabs: TabReport[];
  /** Blocking: Raven cannot work until these are fixed. */
  problems: string[];
  /** Data issues Raven tolerates (rows are hidden or ignored) but someone should fix. */
  warnings: string[];
  applications?: { valid: number; pending: number; byStatus: Record<string, number> };
  users?: { activeAnalysts: number; activeViewers: number; inactive: number };
  reviews?: { records: number };
}

const REQUIRED: Record<TabRole, readonly string[]> = {
  applications: APPLICATION_COLUMNS,
  reviews: REVIEW_COLUMNS,
  users: USER_COLUMNS,
};

const KNOWN_STATUSES = new Set<string>([PENDING_STATUS, AUTO_APPROVED_STATUS, AUTO_DECLINED_STATUS]);
const MAX_LISTED = 10;

function listed(items: string[]): string {
  const shown = items.slice(0, MAX_LISTED).join(", ");
  return items.length > MAX_LISTED ? `${shown} and ${items.length - MAX_LISTED} more` : shown;
}

/** Turns API/auth failures into actionable messages without echoing credentials. */
export function explainAccessError(error: unknown, clientEmail: string): string {
  if (error instanceof SheetsApiError) {
    if (error.status === 403) {
      return `The service account cannot open the spreadsheet. Share it with ${clientEmail} as Editor, and check the Google Sheets API is enabled for its project.`;
    }
    if (error.status === 404) return "Spreadsheet not found. Check GOOGLE_SHEETS_SPREADSHEET_ID.";
    return `Google Sheets API error ${error.status}.`;
  }
  const message = (error instanceof Error ? error.message : String(error)).replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, "[key]");
  return `Could not authenticate as ${clientEmail}: ${message.slice(0, 200)}. The key may be revoked, malformed or for another project.`;
}

function analyseApplications(table: SheetTable, report: SheetsCheckReport): void {
  const applications: SheetApplication[] = [];
  const unparseable: string[] = [];
  for (const row of table.rows) {
    const parsed = parseApplication(table.tab, row);
    if (parsed.ok) applications.push(parsed.value);
    else unparseable.push(parsed.error);
  }
  if (unparseable.length > 0) {
    report.warnings.push(`${unparseable.length} application row(s) cannot be read and will be hidden: ${listed(unparseable)}`);
  }

  const byStatus: Record<string, number> = {};
  for (const app of applications) byStatus[app.application_status || "(empty)"] = (byStatus[app.application_status || "(empty)"] ?? 0) + 1;
  const unknown = Object.keys(byStatus).filter((status) => !KNOWN_STATUSES.has(status));
  if (unknown.length > 0) {
    report.warnings.push(`application_status values Raven ignores: ${listed(unknown)}.`);
  }

  const duplicates = [...findDuplicateBorrowers(applications)];
  if (duplicates.length > 0) {
    report.warnings.push(`Duplicate borrower_id rows (hidden until fixed): ${listed(duplicates)}.`);
  }

  const noCity = applications.filter((app) => !app.city).map((app) => app.borrower_id);
  if (noCity.length > 0) {
    report.warnings.push(`${noCity.length} row(s) have an empty city (City filter cannot match them): ${listed(noCity)}.`);
  }

  report.applications = {
    valid: applications.length,
    pending: applications.filter((app) => app.application_status === PENDING_STATUS && !app.borderline_final_review_status).length,
    byStatus,
  };
}

function analyseUsers(table: SheetTable, report: SheetsCheckReport): void {
  const users = table.rows.map(parseUser);
  const valid = users.filter((user): user is RavenUser => user !== null);
  const invalid = users.length - valid.length;
  if (invalid > 0) {
    report.warnings.push(`${invalid} raven_users row(s) ignored: email missing or role is not "analyst"/"viewer".`);
  }
  const activeAnalysts = valid.filter((user) => user.active && user.role === "analyst").length;
  report.users = {
    activeAnalysts,
    activeViewers: valid.filter((user) => user.active && user.role === "viewer").length,
    inactive: valid.filter((user) => !user.active).length,
  };
  if (activeAnalysts === 0) {
    report.problems.push("No active analyst in raven_users: nobody can sign in to make decisions.");
  }
}

function analyseReviews(table: SheetTable, report: SheetsCheckReport): void {
  const broken = table.rows.filter((row) => !parseReview(table.tab, row).ok).length;
  if (broken > 0) report.warnings.push(`${broken} raven_reviews row(s) are incomplete and ignored.`);
  report.reviews = { records: table.rows.length - broken };
}

export async function checkSheetsSetup(
  client: SheetsClient,
  tabs: SheetsConfig["tabs"],
  clientEmail: string,
): Promise<SheetsCheckReport> {
  const report: SheetsCheckReport = { spreadsheetTitle: null, tabs: [], problems: [], warnings: [] };

  let existing: string[];
  try {
    const metadata = await client.getMetadata();
    report.spreadsheetTitle = metadata.title;
    existing = metadata.tabs;
  } catch (error) {
    report.problems.push(explainAccessError(error, clientEmail));
    return report;
  }

  for (const role of ["applications", "reviews", "users"] as const) {
    const tab = tabs[role];
    if (!existing.includes(tab)) {
      report.tabs.push({ role, tab, status: "missing-tab", missingColumns: [...REQUIRED[role]], unknownColumns: [], rows: 0 });
      report.problems.push(`Tab "${tab}" does not exist (existing tabs: ${existing.join(", ") || "none"}).`);
      continue;
    }

    const [values] = await client.batchGet([quoteTab(tab)]);
    const table = parseTable(tab, values, []);
    const missingColumns = REQUIRED[role].filter((column) => !table.columns.has(column));
    const unknownColumns = [...table.columns.keys()].filter((column) => !REQUIRED[role].includes(column));
    report.tabs.push({
      role,
      tab,
      status: missingColumns.length > 0 ? "missing-columns" : "ok",
      missingColumns,
      unknownColumns,
      rows: table.rows.length,
    });
    if (missingColumns.length > 0) {
      const hint = unknownColumns.length > 0 ? ` Unrecognised header(s): ${unknownColumns.map((c) => `"${c}"`).join(", ")}.` : "";
      report.problems.push(`Tab "${tab}" is missing column(s) in row 1: ${missingColumns.join(", ")}.${hint}`);
    }

    // The workflow's data can be analysed even before Raven's own columns are added.
    const analysable =
      role === "applications"
        ? WORKFLOW_COLUMNS.every((column) => table.columns.has(column))
        : missingColumns.length === 0;
    if (!analysable) continue;
    if (role === "applications") analyseApplications(table, report);
    else if (role === "users") analyseUsers(table, report);
    else analyseReviews(table, report);
  }

  return report;
}

/** Plain-text rendering for the console. Contains counts and borrower IDs only, no PII. */
export function formatReport(report: SheetsCheckReport): string {
  const lines: string[] = [];
  lines.push(`Spreadsheet: ${report.spreadsheetTitle ?? "(not reachable)"}`);
  for (const tab of report.tabs) {
    const detail =
      tab.status === "ok"
        ? `${tab.rows} data row(s)`
        : tab.status === "missing-tab"
          ? "tab not found"
          : `${tab.rows} data row(s); missing columns: ${tab.missingColumns.join(", ")}`;
    lines.push(`  ${tab.status === "ok" ? "OK " : "!! "} ${tab.tab} (${tab.role}): ${detail}`);
    if (tab.unknownColumns.length > 0) lines.push(`       not used by Raven: ${tab.unknownColumns.map((c) => `"${c}"`).join(", ")}`);
  }
  if (report.applications) {
    const statuses = Object.entries(report.applications.byStatus).map(([status, count]) => `${status}=${count}`).join(", ");
    lines.push(`Applications: ${report.applications.valid} readable, ${report.applications.pending} pending review (${statuses || "none"})`);
  }
  if (report.users) {
    lines.push(`Users: ${report.users.activeAnalysts} active analyst(s), ${report.users.activeViewers} active viewer(s), ${report.users.inactive} inactive`);
  }
  if (report.reviews) lines.push(`Reviews logged: ${report.reviews.records}`);
  lines.push(report.problems.length === 0 ? "Problems: none" : "Problems:");
  report.problems.forEach((problem) => lines.push(`  - ${problem}`));
  if (report.warnings.length > 0) {
    lines.push("Warnings:");
    report.warnings.forEach((warning) => lines.push(`  - ${warning}`));
  }
  lines.push("Note: read-only check; write access is not tested.");
  return lines.join("\n");
}
