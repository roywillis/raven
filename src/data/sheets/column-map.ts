import type { HistoricalApplication } from "@/domain/types";

/**
 * PLACEHOLDER: maps domain fields to header names in the master Google Sheet.
 * The real headers, tab layout and the columns for decision metadata are not yet specified in
 * prd.md. Until confirmed, headers are assumed to equal the PRD field names.
 */
export const SHEET_COLUMNS = {
  borrower_id: "borrower_id",
  masked_nik: "masked_nik",
  masked_name: "masked_name",
  business_name: "business_name",
  business_type: "business_type",
  province: "province",
  city: "city",
  credit_score: "credit_score",
  monthly_income_idr: "monthly_income_idr",
  monthly_installment_idr: "monthly_installment_idr",
  dti_ratio: "dti_ratio",
  requested_amount_idr: "requested_amount_idr",
  requested_tenor_months: "requested_tenor_months",
  effective_amount_idr: "effective_amount_idr",
  effective_tenor_months: "effective_tenor_months",
  pd_score: "pd_score",
  pd_label: "pd_label",
  application_status: "application_status",
  risk_summary: "risk_summary",
  decision_source: "decision_source",
  analyst_id: "analyst_id",
  analyst_remarks: "analyst_remarks",
  processed_at_timestamp: "processed_at_timestamp",
} as const satisfies Record<keyof HistoricalApplication, string>;
