import type { SheetsConfig } from "@/config/env";
import type { DecisionPayload } from "@/domain/types";
import {
  NotImplementedError,
  type ApplicationReader,
  type DecisionWriter,
  type HistoricalCategory,
} from "../ports";

/**
 * PLACEHOLDER adapter for the master Google Sheet. Reads and the write-back both go to the
 * same spreadsheet (`config.spreadsheetId`). The live Google Sheets API integration is out of
 * scope for the scaffold; every method throws `NotImplementedError`.
 *
 * Integration notes: writes require a service account (or OAuth); an API key can only read
 * publicly shared sheets. Row/column mapping lives in `./column-map.ts`.
 */
export class SheetsApplicationRepository implements ApplicationReader, DecisionWriter {
  constructor(readonly config: SheetsConfig) {}

  async listIncoming(): Promise<never> {
    throw new NotImplementedError("Google Sheets read (incoming)");
  }

  async listHistorical(_category: HistoricalCategory): Promise<never> {
    void _category;
    throw new NotImplementedError("Google Sheets read (historical)");
  }

  async submitDecision(_decision: DecisionPayload): Promise<never> {
    void _decision;
    throw new NotImplementedError("Google Sheets write-back");
  }
}
