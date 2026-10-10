import { randomUUID } from "node:crypto";
import { getRepositories } from "@/data";
import type { Repositories } from "@/data/ports";
import { buildQueueView, createReviewRecord, indexReviews, stateOf, validateDecisionInput } from "@/domain/review";
import type { QueueView, ReviewRecord } from "@/domain/types";

export class DecisionError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = "DecisionError";
  }
}

export interface DecisionResult {
  review: ReviewRecord;
  /** True when the decision is logged but the master row could not be updated yet. */
  sync_pending: boolean;
}

export interface ResyncResult {
  resynced: string[];
  failed: { borrower_id: string; error: string }[];
}

export interface ReviewServiceOptions {
  newId?: () => string;
  now?: () => Date;
  onSyncError?: (review: ReviewRecord, error: unknown) => void;
}

/**
 * Decision workflow over the data ports. Decisions are serialised within this process; the
 * re-read before writing also rejects decisions already made by another instance.
 */
export class ReviewService {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly newId: () => string;
  private readonly now: () => Date;
  private readonly onSyncError: (review: ReviewRecord, error: unknown) => void;

  constructor(
    private readonly repos: Repositories,
    options: ReviewServiceOptions = {},
  ) {
    this.newId = options.newId ?? randomUUID;
    this.now = options.now ?? (() => new Date());
    this.onSyncError =
      options.onSyncError ??
      ((review, error) => console.error(`[raven] master row sync failed for ${review.borrower_id}:`, error));
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  async getQueue(): Promise<QueueView> {
    const [snapshot, reviews] = await Promise.all([this.repos.applications.listApplications(), this.repos.reviews.listReviews()]);
    const view = buildQueueView(snapshot.applications, reviews, snapshot.errors);
    if (view.data_errors.length > 0) {
      // Not shown in the UI; affected rows are hidden, so surface them in the server logs instead.
      // Messages contain borrower IDs and column names only, no personal data.
      console.warn(`[raven] ${view.data_errors.length} sheet data issue(s):\n- ${view.data_errors.join("\n- ")}`);
    }
    return view;
  }

  /** Validates, logs, then mirrors one decision. `analystEmail` must come from the session. */
  submitDecision(input: unknown, analystEmail: string): Promise<DecisionResult> {
    const validation = validateDecisionInput(input);
    if (!validation.ok) return Promise.reject(new DecisionError(400, validation.error));
    const decision = validation.value;

    return this.exclusive(async () => {
      const [snapshot, reviews] = await Promise.all([
        this.repos.applications.listApplications(),
        this.repos.reviews.listReviews(),
      ]);
      const matches = snapshot.applications.filter((app) => app.borrower_id === decision.borrower_id);
      if (matches.length === 0) throw new DecisionError(404, `Application ${decision.borrower_id} was not found.`);
      if (matches.length > 1) {
        throw new DecisionError(409, `Borrower ${decision.borrower_id} appears on more than one row; fix the sheet first.`);
      }
      const app = matches[0];
      const existing = indexReviews(reviews).byBorrower.get(app.borrower_id);
      const state = stateOf(app, existing);
      if (state.kind !== "pending") {
        const by = existing ? ` by ${existing.analyst_email} at ${existing.decided_at}` : "";
        throw new DecisionError(409, `Application ${app.borrower_id} is no longer pending review (already decided${by}).`);
      }

      const review = createReviewRecord(app, decision, analystEmail, this.newId(), this.now());
      await this.repos.reviews.appendReview(review);
      try {
        await this.repos.reviews.markApplicationReviewed(review);
        return { review, sync_pending: false };
      } catch (error) {
        this.onSyncError(review, error);
        return { review, sync_pending: true };
      }
    });
  }

  /** Re-applies logged decisions whose master row was not updated. Safe to run repeatedly. */
  resync(): Promise<ResyncResult> {
    return this.exclusive(async () => {
      const [snapshot, reviews] = await Promise.all([
        this.repos.applications.listApplications(),
        this.repos.reviews.listReviews(),
      ]);
      const { byBorrower } = indexReviews(reviews);
      const result: ResyncResult = { resynced: [], failed: [] };
      for (const app of snapshot.applications) {
        const review = byBorrower.get(app.borrower_id);
        if (!review || app.review_id === review.review_id) continue;
        try {
          await this.repos.reviews.markApplicationReviewed(review);
          result.resynced.push(app.borrower_id);
        } catch (error) {
          result.failed.push({ borrower_id: app.borrower_id, error: error instanceof Error ? error.message : String(error) });
        }
      }
      return result;
    });
  }
}

const holder = globalThis as typeof globalThis & { __ravenReviewService?: ReviewService };

export function getReviewService(): ReviewService {
  holder.__ravenReviewService ??= new ReviewService(getRepositories());
  return holder.__ravenReviewService;
}
