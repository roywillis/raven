import type { DecisionAction, FinalReviewStatus, WorkflowStatus } from "./types";

/** Workflow status of applications waiting for analyst review (prd.md §2.1). */
export const PENDING_STATUS = "BORDERLINE_HITL" satisfies WorkflowStatus;
export const AUTO_APPROVED_STATUS = "APPROVED_AUTO" satisfies WorkflowStatus;
export const AUTO_DECLINED_STATUS = "DECLINED_AUTO" satisfies WorkflowStatus;

/** Status transition matrix (prd.md §6.2). */
export const DECISION_STATUS: Record<DecisionAction, FinalReviewStatus> = {
  ACCEPT: "APPROVED_HITL",
  REJECT: "DECLINED_HITL",
};

export const FINAL_REVIEW_STATUSES: readonly FinalReviewStatus[] = ["APPROVED_HITL", "DECLINED_HITL"];

export function isFinalReviewStatus(value: string): value is FinalReviewStatus {
  return (FINAL_REVIEW_STATUSES as readonly string[]).includes(value);
}
