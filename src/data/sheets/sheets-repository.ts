import type { SheetsConfig } from "@/config/env";
import type { RavenUser, ReviewRecord } from "@/domain/types";
import type { ApplicationReader, ApplicationsSnapshot, ReviewStore, UserDirectory } from "../ports";
import type { SheetsClient } from "./client";
import { columnLetter, parseTable, quoteTab, SheetSchemaError } from "./header-map";
import {
  APPLICATION_COLUMNS,
  parseApplication,
  parseReview,
  parseUser,
  REVIEW_COLUMNS,
  toRow,
  USER_COLUMNS,
} from "./schema";

const USERS_CACHE_MS = 60_000;

/**
 * Google Sheets adapter. Reads and writes go to one spreadsheet:
 * - `applications` (master, n8n-owned): read; Raven writes only its own mirror columns.
 * - `raven_reviews` (Raven-owned): append-only decision log.
 * - `raven_users`: pre-registered users.
 */
export class SheetsRepository implements ApplicationReader, ReviewStore, UserDirectory {
  private usersCache: { at: number; users: RavenUser[] } | null = null;

  constructor(
    private readonly client: SheetsClient,
    private readonly tabs: SheetsConfig["tabs"],
    private readonly now: () => number = Date.now,
  ) {}

  private async readTab(tab: string, required: readonly string[]) {
    const [values] = await this.client.batchGet([quoteTab(tab)]);
    return parseTable(tab, values, required);
  }

  async listApplications(): Promise<ApplicationsSnapshot> {
    const table = await this.readTab(this.tabs.applications, APPLICATION_COLUMNS);
    const snapshot: ApplicationsSnapshot = { applications: [], errors: [] };
    for (const row of table.rows) {
      const parsed = parseApplication(table.tab, row);
      if (parsed.ok) snapshot.applications.push(parsed.value);
      else snapshot.errors.push(parsed.error);
    }
    return snapshot;
  }

  async listReviews(): Promise<ReviewRecord[]> {
    const table = await this.readTab(this.tabs.reviews, REVIEW_COLUMNS);
    return table.rows.flatMap((row) => {
      const parsed = parseReview(table.tab, row);
      return parsed.ok ? [parsed.value] : [];
    });
  }

  async appendReview(review: ReviewRecord): Promise<void> {
    const [header] = await this.client.batchGet([`${quoteTab(this.tabs.reviews)}!1:1`]);
    const table = parseTable(this.tabs.reviews, header, REVIEW_COLUMNS);
    await this.client.append(`${quoteTab(this.tabs.reviews)}!A1`, [toRow(table.columns, { ...review })]);
  }

  async markApplicationReviewed(review: ReviewRecord): Promise<void> {
    const table = await this.readTab(this.tabs.applications, APPLICATION_COLUMNS);
    const rows = table.rows.filter((row) => String(row.get("borrower_id") ?? "").trim() === review.borrower_id);
    if (rows.length !== 1) {
      throw new SheetSchemaError(
        `Expected exactly one "${table.tab}" row for ${review.borrower_id}, found ${rows.length}.`,
      );
    }
    const cells: Record<string, string> = {
      borderline_final_review_status: review.final_status,
      reviewed_by: review.analyst_email,
      reviewed_at: review.decided_at,
      review_remarks: review.remarks,
      review_id: review.review_id,
    };
    const rowNumber = rows[0].rowNumber;
    await this.client.batchUpdate(
      Object.entries(cells).map(([column, value]) => ({
        range: `${quoteTab(table.tab)}!${columnLetter(table.columns.get(column)!)}${rowNumber}`,
        values: [[value]],
      })),
    );
  }

  async listUsers(): Promise<RavenUser[]> {
    if (this.usersCache && this.now() - this.usersCache.at < USERS_CACHE_MS) return this.usersCache.users;
    const table = await this.readTab(this.tabs.users, USER_COLUMNS);
    const users = table.rows.map(parseUser).filter((user): user is RavenUser => user !== null);
    this.usersCache = { at: this.now(), users };
    return users;
  }

  async findUser(email: string): Promise<RavenUser | null> {
    const target = email.trim().toLowerCase();
    return (await this.listUsers()).find((user) => user.email === target) ?? null;
  }
}
