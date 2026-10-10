/**
 * Data contracts. Sheet column names are used verbatim as field names (see prd.md §5).
 */

/** `application_status` values written by the n8n workflow. Other values are ignored by Raven. */
export type WorkflowStatus = "BORDERLINE_HITL" | "APPROVED_AUTO" | "DECLINED_AUTO";

/** Values Raven writes to `borderline_final_review_status`. */
export type FinalReviewStatus = "APPROVED_HITL" | "DECLINED_HITL";

export type DecisionAction = "ACCEPT" | "REJECT";

export type DecisionSource = "STP" | "HITL";

export type UserRole = "analyst" | "viewer";

/** One row of the master `applications` tab. Raw PII: never send this to the browser. */
export interface SheetApplication {
  borrower_id: string;
  nik: string;
  borrower_name: string;
  business_name: string;
  business_type: string;
  province: string;
  city: string;
  tenor_months: number;
  monthly_income_idr: number;
  loan_amount_granted: number;
  application_status: string;
  pd_score: number;
  /** AI-agent note from the workflow explaining the borderline categorisation. */
  decision_notes: string;
  /** Raven-written columns on the master row (empty until reviewed). */
  borderline_final_review_status: FinalReviewStatus | "";
  reviewed_by: string;
  reviewed_at: string;
  review_remarks: string;
  review_id: string;
}

/** One row of the Raven-owned, append-only `raven_reviews` tab. */
export interface ReviewRecord {
  review_id: string;
  borrower_id: string;
  action: DecisionAction;
  final_status: FinalReviewStatus;
  remarks: string;
  analyst_email: string;
  /** ISO-8601 UTC. */
  decided_at: string;
  /** Snapshot of the application at decision time. */
  pd_score: number;
  loan_amount_granted: number;
  tenor_months: number;
}

/** One row of the `raven_users` tab. */
export interface RavenUser {
  email: string;
  display_name: string;
  role: UserRole;
  active: boolean;
}

/** Analyst-submitted decision (request body of POST /api/decisions). */
export interface DecisionInput {
  borrower_id: string;
  action: DecisionAction;
  remarks?: string;
}

/** Browser-safe application: PII masked. */
export interface ApplicationView {
  borrower_id: string;
  masked_nik: string;
  masked_name: string;
  business_name: string;
  business_type: string;
  province: string;
  city: string;
  tenor_months: number;
  monthly_income_idr: number;
  loan_amount_granted: number;
  pd_score: number;
  pd_label: string;
  decision_notes: string;
}

/** Browser-safe historical record for Tab 2. */
export interface HistoryView extends ApplicationView {
  final_status: WorkflowStatus | FinalReviewStatus;
  decision_source: DecisionSource;
  decided_at: string | null;
  analyst_email: string | null;
  remarks: string | null;
  /** Decision is logged in `raven_reviews` but not yet mirrored to the master row. */
  sync_pending: boolean;
}

export interface QueueView {
  pending: ApplicationView[];
  accepted: HistoryView[];
  rejected: HistoryView[];
  /** Human-readable data problems (duplicate borrower IDs, unparseable rows). */
  data_errors: string[];
}
