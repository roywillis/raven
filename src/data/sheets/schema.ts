import { isFinalReviewStatus } from "@/domain/status";
import type { RavenUser, ReviewRecord, SheetApplication } from "@/domain/types";
import { asBoolean, asNumber, asString, type Cell, type SheetRow } from "./header-map";

/** Columns the n8n workflow writes to the master tab. */
export const WORKFLOW_COLUMNS = [
  "borrower_id",
  "nik",
  "borrower_name",
  "business_name",
  "business_type",
  "province",
  "city",
  "credit_score",
  "tenor_months",
  "monthly_income_idr",
  "loan_amount_granted",
  "application_status",
  "pd_score",
  "decision_notes",
] as const;

/** Columns on the master tab that only Raven writes. */
export const RAVEN_MASTER_COLUMNS = [
  "borderline_final_review_status",
  "reviewed_by",
  "reviewed_at",
  "review_remarks",
  "review_id",
] as const;

export const APPLICATION_COLUMNS = [...WORKFLOW_COLUMNS, ...RAVEN_MASTER_COLUMNS] as const;

export const REVIEW_COLUMNS = [
  "review_id",
  "borrower_id",
  "action",
  "final_status",
  "remarks",
  "analyst_email",
  "decided_at",
  "pd_score",
  "loan_amount_granted",
  "tenor_months",
] as const satisfies readonly (keyof ReviewRecord)[];

export const USER_COLUMNS = ["email", "display_name", "role", "active"] as const;

const NUMERIC_APPLICATION_COLUMNS = [
  "credit_score",
  "tenor_months",
  "monthly_income_idr",
  "loan_amount_granted",
  "pd_score",
] as const;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseApplication(tab: string, row: SheetRow): Parsed<SheetApplication> {
  const text = (column: string) => asString(row.get(column));
  const borrowerId = text("borrower_id");
  if (!borrowerId) return { ok: false, error: `${tab} row ${row.rowNumber}: borrower_id is empty.` };

  const numbers = {} as Record<(typeof NUMERIC_APPLICATION_COLUMNS)[number], number>;
  for (const column of NUMERIC_APPLICATION_COLUMNS) {
    const value = asNumber(row.get(column));
    if (Number.isNaN(value)) {
      return { ok: false, error: `${tab} row ${row.rowNumber} (${borrowerId}): ${column} is not a number.` };
    }
    numbers[column] = value;
  }

  const finalStatus = text("borderline_final_review_status");
  return {
    ok: true,
    value: {
      borrower_id: borrowerId,
      nik: text("nik"),
      borrower_name: text("borrower_name"),
      business_name: text("business_name"),
      business_type: text("business_type"),
      province: text("province"),
      city: text("city"),
      application_status: text("application_status"),
      decision_notes: text("decision_notes"),
      borderline_final_review_status: isFinalReviewStatus(finalStatus) ? finalStatus : "",
      reviewed_by: text("reviewed_by"),
      reviewed_at: text("reviewed_at"),
      review_remarks: text("review_remarks"),
      review_id: text("review_id"),
      ...numbers,
    },
  };
}

export function parseReview(tab: string, row: SheetRow): Parsed<ReviewRecord> {
  const text = (column: string) => asString(row.get(column));
  const action = text("action");
  const finalStatus = text("final_status");
  if (!text("review_id") || !text("borrower_id") || (action !== "ACCEPT" && action !== "REJECT") || !isFinalReviewStatus(finalStatus)) {
    return { ok: false, error: `${tab} row ${row.rowNumber}: incomplete review record.` };
  }
  return {
    ok: true,
    value: {
      review_id: text("review_id"),
      borrower_id: text("borrower_id"),
      action,
      final_status: finalStatus,
      remarks: text("remarks"),
      analyst_email: text("analyst_email"),
      decided_at: text("decided_at"),
      pd_score: asNumber(row.get("pd_score")),
      loan_amount_granted: asNumber(row.get("loan_amount_granted")),
      tenor_months: asNumber(row.get("tenor_months")),
    },
  };
}

export function parseUser(row: SheetRow): RavenUser | null {
  const email = asString(row.get("email")).toLowerCase();
  const role = asString(row.get("role")).toLowerCase();
  if (!email || (role !== "analyst" && role !== "viewer")) return null;
  return {
    email,
    display_name: asString(row.get("display_name")) || email,
    role,
    active: asBoolean(row.get("active")),
  };
}

/** Orders a record's values to match the tab's header row. */
export function toRow(columns: Map<string, number>, record: Record<string, Cell>): Cell[] {
  const width = Math.max(...columns.values()) + 1;
  const cells: Cell[] = Array.from({ length: width }, () => "");
  for (const [name, index] of columns) {
    if (name in record) cells[index] = record[name];
  }
  return cells;
}
