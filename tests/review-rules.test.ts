import { describe, expect, it } from "vitest";
import { buildQueueView, REJECT_REMARKS_ERROR, validateDecisionInput } from "@/domain/review";
import { makeApp, makeReview } from "./helpers";

describe("validateDecisionInput (prd.md §6.1, v2.1)", () => {
  it("accepts ACCEPT without remarks", () => {
    expect(validateDecisionInput({ borrower_id: "BOR-0026", action: "ACCEPT" })).toEqual({
      ok: true,
      value: { borrower_id: "BOR-0026", action: "ACCEPT", remarks: "" },
    });
  });

  it("blocks REJECT with empty or short remarks (after trimming)", () => {
    for (const remarks of [undefined, "", "   ", "too short", "   123456789   "]) {
      expect(validateDecisionInput({ borrower_id: "BOR-0014", action: "REJECT", remarks })).toEqual({
        ok: false,
        error: REJECT_REMARKS_ERROR,
      });
    }
  });

  it("accepts REJECT with at least 10 characters and trims them", () => {
    const result = validateDecisionInput({ borrower_id: "BOR-0014", action: "REJECT", remarks: "  Cash flow unverified  " });
    expect(result).toEqual({ ok: true, value: { borrower_id: "BOR-0014", action: "REJECT", remarks: "Cash flow unverified" } });
  });

  it("rejects malformed input", () => {
    expect(validateDecisionInput(null).ok).toBe(false);
    expect(validateDecisionInput({ borrower_id: "BOR 1;DROP", action: "ACCEPT" }).ok).toBe(false);
    expect(validateDecisionInput({ borrower_id: "BOR-1", action: "APPROVE" }).ok).toBe(false);
    expect(validateDecisionInput({ borrower_id: "BOR-1", action: "ACCEPT", remarks: 42 }).ok).toBe(false);
    expect(validateDecisionInput({ borrower_id: "BOR-1", action: "ACCEPT", remarks: "x".repeat(1001) }).ok).toBe(false);
  });
});

describe("buildQueueView", () => {
  it("lists BORDERLINE_HITL rows without a review as pending, with PII masked", () => {
    const view = buildQueueView([makeApp()], []);
    expect(view.pending).toHaveLength(1);
    expect(view.pending[0]).toMatchObject({ masked_nik: "3578****0020", masked_name: "A*** G***", pd_label: "10.00%" });
    expect(JSON.stringify(view)).not.toContain("3578010101900020");
    expect(JSON.stringify(view)).not.toContain("Anton Gunawan");
  });

  it("moves a reviewed application to history, flagging a missing master sync", () => {
    const view = buildQueueView([makeApp()], [makeReview()]);
    expect(view.pending).toHaveLength(0);
    expect(view.accepted[0]).toMatchObject({
      borrower_id: "BOR-0026",
      final_status: "APPROVED_HITL",
      decision_source: "HITL",
      analyst_email: "analyst@raven.local",
      sync_pending: true,
    });

    const synced = buildQueueView([makeApp({ review_id: "rev-1", borderline_final_review_status: "APPROVED_HITL" })], [makeReview()]);
    expect(synced.accepted[0].sync_pending).toBe(false);
  });

  it("treats a master row already marked final as decided even without a log entry", () => {
    const view = buildQueueView(
      [makeApp({ borderline_final_review_status: "DECLINED_HITL", reviewed_by: "a@x.id", review_remarks: "Fraud flag raised" })],
      [],
    );
    expect(view.pending).toHaveLength(0);
    expect(view.rejected[0]).toMatchObject({ analyst_email: "a@x.id", remarks: "Fraud flag raised", sync_pending: false });
  });

  it("puts STP decisions in the right sub-tab and ignores unknown statuses", () => {
    const view = buildQueueView(
      [
        makeApp({ borrower_id: "A", application_status: "APPROVED_AUTO" }),
        makeApp({ borrower_id: "D", application_status: "DECLINED_AUTO" }),
        makeApp({ borrower_id: "X", application_status: "SCORING" }),
      ],
      [],
    );
    expect(view.accepted.map((row) => [row.borrower_id, row.decision_source])).toEqual([["A", "STP"]]);
    expect(view.rejected.map((row) => row.borrower_id)).toEqual(["D"]);
    expect(view.pending).toHaveLength(0);
  });

  it("hides duplicate borrower IDs and reports them", () => {
    const view = buildQueueView([makeApp(), makeApp({ city: "Malang" })], []);
    expect(view.pending).toHaveLength(0);
    expect(view.data_errors).toEqual(["Borrower BOR-0026 appears on more than one row and is hidden until fixed."]);
  });

  it("uses the earliest of conflicting reviews and reports the conflict", () => {
    const view = buildQueueView(
      [makeApp()],
      [
        makeReview({ review_id: "late", action: "REJECT", final_status: "DECLINED_HITL", decided_at: "2026-10-10T01:00:00Z" }),
        makeReview({ review_id: "early", decided_at: "2026-10-10T00:00:00Z" }),
      ],
    );
    expect(view.accepted).toHaveLength(1);
    expect(view.rejected).toHaveLength(0);
    expect(view.data_errors[0]).toContain("more than one review; using early");
  });
});
