import { maskName, maskNik } from "./masking";
import {
  AUTO_APPROVED_STATUS,
  AUTO_DECLINED_STATUS,
  DECISION_STATUS,
  PENDING_STATUS,
  isFinalReviewStatus,
} from "./status";
import type {
  ApplicationView,
  DecisionInput,
  FinalReviewStatus,
  HistoryView,
  QueueView,
  ReviewRecord,
  SheetApplication,
} from "./types";

export const REMARKS_MIN_LENGTH = 10;
export const REMARKS_MAX_LENGTH = 1000;
export const REJECT_REMARKS_ERROR = `Remarks are required to reject (minimum ${REMARKS_MIN_LENGTH} characters).`;

const BORROWER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export type ValidationResult = { ok: true; value: DecisionInput } | { ok: false; error: string };

/**
 * Validates an analyst decision (prd.md §6.1, as amended in v2.1): remarks are mandatory
 * (≥ 10 characters after trimming) for REJECT and optional for ACCEPT.
 */
export function validateDecisionInput(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const { borrower_id, action, remarks } = input as Record<string, unknown>;

  if (typeof borrower_id !== "string" || !BORROWER_ID_PATTERN.test(borrower_id)) {
    return { ok: false, error: "borrower_id is missing or invalid." };
  }
  if (action !== "ACCEPT" && action !== "REJECT") {
    return { ok: false, error: 'action must be "ACCEPT" or "REJECT".' };
  }
  if (remarks !== undefined && remarks !== null && typeof remarks !== "string") {
    return { ok: false, error: "remarks must be a string." };
  }
  const trimmed = (remarks ?? "").trim();
  if (action === "REJECT" && trimmed.length < REMARKS_MIN_LENGTH) {
    return { ok: false, error: REJECT_REMARKS_ERROR };
  }
  if (trimmed.length > REMARKS_MAX_LENGTH) {
    return { ok: false, error: `Remarks must be at most ${REMARKS_MAX_LENGTH} characters.` };
  }
  return { ok: true, value: { borrower_id, action, remarks: trimmed } };
}

/** Builds the immutable review record written to `raven_reviews`. */
export function createReviewRecord(
  application: SheetApplication,
  decision: DecisionInput,
  analystEmail: string,
  reviewId: string,
  now: Date,
): ReviewRecord {
  return {
    review_id: reviewId,
    borrower_id: application.borrower_id,
    action: decision.action,
    final_status: DECISION_STATUS[decision.action],
    remarks: decision.remarks ?? "",
    analyst_email: analystEmail,
    decided_at: now.toISOString(),
    pd_score: application.pd_score,
    loan_amount_granted: application.loan_amount_granted,
    tenor_months: application.tenor_months,
  };
}

export function formatPd(pdScore: number): string {
  return `${(pdScore * 100).toFixed(2)}%`;
}

export function toApplicationView(app: SheetApplication): ApplicationView {
  return {
    borrower_id: app.borrower_id,
    masked_nik: maskNik(app.nik),
    masked_name: maskName(app.borrower_name),
    business_name: app.business_name,
    business_type: app.business_type,
    province: app.province,
    city: app.city,
    credit_score: app.credit_score,
    tenor_months: app.tenor_months,
    monthly_income_idr: app.monthly_income_idr,
    loan_amount_granted: app.loan_amount_granted,
    pd_score: app.pd_score,
    pd_label: formatPd(app.pd_score),
    decision_notes: app.decision_notes,
  };
}

/** Review state of one application, derived from the review log first, then the master row. */
export type ApplicationState =
  | { kind: "pending" }
  | { kind: "decided"; final_status: FinalReviewStatus; review: ReviewRecord | null; sync_pending: boolean }
  | { kind: "auto"; final_status: "APPROVED_AUTO" | "DECLINED_AUTO" }
  | { kind: "other" };

export function stateOf(app: SheetApplication, review: ReviewRecord | undefined): ApplicationState {
  if (review) {
    return {
      kind: "decided",
      final_status: review.final_status,
      review,
      sync_pending: app.review_id !== review.review_id,
    };
  }
  // Decided on the master row but missing from the log (e.g. log edited by hand): still decided.
  if (isFinalReviewStatus(app.borderline_final_review_status)) {
    return { kind: "decided", final_status: app.borderline_final_review_status, review: null, sync_pending: false };
  }
  if (app.application_status === PENDING_STATUS) return { kind: "pending" };
  if (app.application_status === AUTO_APPROVED_STATUS || app.application_status === AUTO_DECLINED_STATUS) {
    return { kind: "auto", final_status: app.application_status };
  }
  return { kind: "other" };
}

/** Indexes reviews by borrower. The earliest decision wins; later ones are reported as conflicts. */
export function indexReviews(reviews: ReviewRecord[]): { byBorrower: Map<string, ReviewRecord>; errors: string[] } {
  const byBorrower = new Map<string, ReviewRecord>();
  const errors: string[] = [];
  const sorted = [...reviews].sort((a, b) => a.decided_at.localeCompare(b.decided_at));
  for (const review of sorted) {
    const first = byBorrower.get(review.borrower_id);
    if (first) {
      errors.push(
        `Borrower ${review.borrower_id} has more than one review; using ${first.review_id} (${first.decided_at}).`,
      );
      continue;
    }
    byBorrower.set(review.borrower_id, review);
  }
  return { byBorrower, errors };
}

/** Finds borrower IDs that appear on more than one master row (MVP: one loan per borrower). */
export function findDuplicateBorrowers(apps: SheetApplication[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const app of apps) {
    if (seen.has(app.borrower_id)) duplicates.add(app.borrower_id);
    seen.add(app.borrower_id);
  }
  return duplicates;
}

function toHistoryView(app: SheetApplication, state: Extract<ApplicationState, { kind: "decided" | "auto" }>): HistoryView {
  const base = toApplicationView(app);
  if (state.kind === "auto") {
    return {
      ...base,
      final_status: state.final_status,
      decision_source: "STP",
      decided_at: null,
      analyst_email: null,
      remarks: null,
      sync_pending: false,
    };
  }
  const review = state.review;
  return {
    ...base,
    final_status: state.final_status,
    decision_source: "HITL",
    decided_at: review?.decided_at ?? (app.reviewed_at || null),
    analyst_email: review?.analyst_email ?? (app.reviewed_by || null),
    remarks: review?.remarks ?? (app.review_remarks || null),
    sync_pending: state.sync_pending,
  };
}

const byDecidedAtDesc = (a: HistoryView, b: HistoryView) => (b.decided_at ?? "").localeCompare(a.decided_at ?? "");

/** Splits applications into the Tab 1 queue and the Tab 2 history (prd.md §2). */
export function buildQueueView(
  apps: SheetApplication[],
  reviews: ReviewRecord[],
  parseErrors: string[] = [],
): QueueView {
  const { byBorrower, errors } = indexReviews(reviews);
  const duplicates = findDuplicateBorrowers(apps);
  const view: QueueView = { pending: [], accepted: [], rejected: [], data_errors: [...parseErrors, ...errors] };

  for (const id of duplicates) {
    view.data_errors.push(`Borrower ${id} appears on more than one row and is hidden until fixed.`);
  }

  for (const app of apps) {
    if (duplicates.has(app.borrower_id)) continue;
    const state = stateOf(app, byBorrower.get(app.borrower_id));
    if (state.kind === "pending") view.pending.push(toApplicationView(app));
    else if (state.kind === "decided" || state.kind === "auto") {
      const history = toHistoryView(app, state);
      (state.final_status.startsWith("APPROVED") ? view.accepted : view.rejected).push(history);
    }
  }

  view.pending.sort((a, b) => a.borrower_id.localeCompare(b.borrower_id));
  view.accepted.sort(byDecidedAtDesc);
  view.rejected.sort(byDecidedAtDesc);
  return view;
}
