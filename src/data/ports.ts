import type { DecisionPayload, HistoricalApplication, IncomingApplication } from "@/domain/types";

/**
 * Data-access interfaces. UI and route handlers depend only on these; the backing store
 * (fixture file today, the master Google Sheet later) is chosen in `./index.ts`.
 */

export type HistoricalCategory = "accepted" | "rejected";

export interface ApplicationReader {
  /** Pending borderline applications for Tab 1 (`application_status == 'BORDERLINE_HITL'`). */
  listIncoming(): Promise<IncomingApplication[]>;
  /** View-only decided applications for a Tab 2 sub-tab. */
  listHistorical(category: HistoricalCategory): Promise<HistoricalApplication[]>;
}

export interface DecisionWriter {
  /** Writes an analyst decision back to the master store (prd.md §2.3, §5.2). */
  submitDecision(decision: DecisionPayload): Promise<void>;
}

export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`${feature} is not implemented yet.`);
    this.name = "NotImplementedError";
  }
}
