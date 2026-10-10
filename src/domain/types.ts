/** Data contracts from prd.md §5. Field names match the PRD payloads exactly. */

export type ApplicationStatus =
  | "BORDERLINE_HITL"
  | "APPROVED_AUTO"
  | "APPROVED_HITL"
  | "DECLINED_AUTO"
  | "DECLINED_HITL";

export type DecisionAction = "ACCEPT" | "REJECT";

/** prd.md §5.1: ingested application payload (Incoming tab). */
export interface IncomingApplication {
  borrower_id: string;
  masked_nik: string;
  masked_name: string;
  business_name: string;
  business_type: string;
  province: string;
  city: string;
  credit_score: number;
  monthly_income_idr: number;
  monthly_installment_idr: number;
  dti_ratio: number;
  requested_amount_idr: number;
  requested_tenor_months: number;
  effective_amount_idr: number;
  effective_tenor_months: number;
  pd_score: number;
  pd_label: string;
  application_status: ApplicationStatus;
  risk_summary: string;
}

/** prd.md §5.2: analyst decision write-back payload. */
export interface DecisionPayload {
  borrower_id: string;
  analyst_id: string;
  action: DecisionAction;
  updated_status: Extract<ApplicationStatus, "APPROVED_HITL" | "DECLINED_HITL">;
  remarks: string;
  /** ISO-8601 UTC timestamp. */
  timestamp: string;
}

/**
 * Historical (view-only) record, prd.md §2.2 and Story 3. The PRD does not define the sheet
 * columns for decision metadata, so these fields are optional until the sheet layout is confirmed.
 */
export interface HistoricalApplication extends IncomingApplication {
  decision_source?: "STP" | "HITL";
  analyst_id?: string;
  analyst_remarks?: string;
  processed_at_timestamp?: string;
}
