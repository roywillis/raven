import type { ApplicationStatus, DecisionAction, DecisionPayload } from "./types";

/** Status shown in Tab 1 (prd.md §2.1). */
export const PENDING_STATUS = "BORDERLINE_HITL" satisfies ApplicationStatus;

/** Statuses per Tab 2 sub-tab (prd.md §2.2). */
export const ACCEPTED_STATUSES = ["APPROVED_AUTO", "APPROVED_HITL"] as const satisfies readonly ApplicationStatus[];
export const REJECTED_STATUSES = ["DECLINED_AUTO", "DECLINED_HITL"] as const satisfies readonly ApplicationStatus[];

/** Status transition matrix (prd.md §6.2). */
export const DECISION_STATUS: Record<DecisionAction, DecisionPayload["updated_status"]> = {
  ACCEPT: "APPROVED_HITL",
  REJECT: "DECLINED_HITL",
};
