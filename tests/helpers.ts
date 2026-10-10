import type { ReviewRecord, SheetApplication } from "@/domain/types";

export function makeApp(overrides: Partial<SheetApplication> = {}): SheetApplication {
  return {
    borrower_id: "BOR-0026",
    nik: "3578010101900020",
    borrower_name: "Anton Gunawan",
    business_name: "Distributor Sayur Anton",
    business_type: "Pertanian",
    province: "Jawa Timur",
    city: "Surabaya",
    tenor_months: 12,
    monthly_income_idr: 90000000,
    loan_amount_granted: 250000000,
    application_status: "BORDERLINE_HITL",
    pd_score: 0.1,
    decision_notes: "Moderate risk.",
    borderline_final_review_status: "",
    reviewed_by: "",
    reviewed_at: "",
    review_remarks: "",
    review_id: "",
    ...overrides,
  };
}

export function makeReview(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    review_id: "rev-1",
    borrower_id: "BOR-0026",
    action: "ACCEPT",
    final_status: "APPROVED_HITL",
    remarks: "",
    analyst_email: "analyst@raven.local",
    decided_at: "2026-10-09T23:25:00.000Z",
    pd_score: 0.1,
    loan_amount_granted: 250000000,
    tenor_months: 12,
    ...overrides,
  };
}

export const SERVICE_ACCOUNT_JSON = JSON.stringify({
  client_email: "raven@project.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
});

export const SECRET = "x".repeat(32);
