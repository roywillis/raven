import type { RavenUser, ReviewRecord, SheetApplication } from "@/domain/types";

/**
 * Data-access interfaces. Services and route handlers depend only on these; the backing store
 * (fixture files locally, the master Google Sheet in production) is chosen in `./index.ts`.
 */

export interface ApplicationsSnapshot {
  applications: SheetApplication[];
  /** Rows that could not be parsed (reported to analysts, excluded from views). */
  errors: string[];
}

/** Reads the master `applications` tab (owned by the n8n workflow). */
export interface ApplicationReader {
  listApplications(): Promise<ApplicationsSnapshot>;
}

/** Raven's review log plus the mirror columns it maintains on the master row. */
export interface ReviewStore {
  listReviews(): Promise<ReviewRecord[]>;
  /** Appends to the append-only `raven_reviews` log. This is the decision's commit point. */
  appendReview(review: ReviewRecord): Promise<void>;
  /**
   * Mirrors a logged decision onto the borrower's master row (`borderline_final_review_status`,
   * `reviewed_by`, `reviewed_at`, `review_remarks`, `review_id`). Must be safe to repeat.
   */
  markApplicationReviewed(review: ReviewRecord): Promise<void>;
}

/** Pre-registered users (`raven_users` tab). */
export interface UserDirectory {
  findUser(email: string): Promise<RavenUser | null>;
  listUsers(): Promise<RavenUser[]>;
}

export interface Repositories {
  applications: ApplicationReader;
  reviews: ReviewStore;
  users: UserDirectory;
}
