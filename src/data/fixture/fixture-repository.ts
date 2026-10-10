import { ACCEPTED_STATUSES, PENDING_STATUS, REJECTED_STATUSES } from "@/domain/status";
import type { ApplicationStatus, DecisionPayload, HistoricalApplication } from "@/domain/types";
import sampleRows from "../../../fixtures/applications.sample.json";
import {
  NotImplementedError,
  type ApplicationReader,
  type DecisionWriter,
  type HistoricalCategory,
} from "../ports";

const HISTORICAL_STATUSES: Record<HistoricalCategory, readonly ApplicationStatus[]> = {
  accepted: ACCEPTED_STATUSES,
  rejected: REJECTED_STATUSES,
};

/** In-memory adapter over the bundled, fictional sample rows. For local development and tests. */
export class FixtureApplicationRepository implements ApplicationReader, DecisionWriter {
  constructor(private readonly rows: HistoricalApplication[] = sampleRows as HistoricalApplication[]) {}

  async listIncoming() {
    return this.rows.filter((row) => row.application_status === PENDING_STATUS);
  }

  async listHistorical(category: HistoricalCategory) {
    const statuses = HISTORICAL_STATUSES[category];
    return this.rows.filter((row) => statuses.includes(row.application_status));
  }

  async submitDecision(_decision: DecisionPayload): Promise<void> {
    void _decision;
    throw new NotImplementedError("Decision write-back");
  }
}
