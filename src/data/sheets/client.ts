import { JWT } from "google-auth-library";
import type { ServiceAccountCredentials } from "@/config/env";
import type { Cell } from "./header-map";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export class SheetsApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "SheetsApiError";
  }
}

export interface SheetsClientOptions {
  spreadsheetId: string;
  getAccessToken: () => Promise<string>;
  fetch?: typeof fetch;
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * Minimal Google Sheets v4 REST client (values get / append / batchUpdate).
 * Writes use `valueInputOption=RAW`, so user text such as "=HYPERLINK(...)" is stored as text,
 * never evaluated as a formula.
 */
export class SheetsClient {
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(private readonly options: SheetsClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 500;
  }

  private url(path: string, query: Record<string, string> = {}): string {
    const params = new URLSearchParams(query).toString();
    return `${SHEETS_API}/${encodeURIComponent(this.options.spreadsheetId)}${path}${params ? `?${params}` : ""}`;
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const token = await this.options.getAccessToken();
      const response = await this.fetchImpl(url, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (response.ok) return (await response.json()) as T;
      if (RETRYABLE.has(response.status) && attempt < this.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * 2 ** attempt));
        continue;
      }
      const body = await response.text();
      throw new SheetsApiError(response.status, `Google Sheets API ${response.status}: ${body.slice(0, 300)}`);
    }
  }

  async batchGet(ranges: string[]): Promise<Cell[][][]> {
    const query = new URLSearchParams({ valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "FORMATTED_STRING" });
    ranges.forEach((range) => query.append("ranges", range));
    const data = await this.request<{ valueRanges?: { values?: Cell[][] }[] }>(
      `${this.url("/values:batchGet")}?${query.toString()}`,
    );
    return ranges.map((_, index) => data.valueRanges?.[index]?.values ?? []);
  }

  async append(range: string, rows: Cell[][]): Promise<void> {
    await this.request(
      this.url(`/values/${encodeURIComponent(range)}:append`, {
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
      }),
      { method: "POST", body: JSON.stringify({ values: rows }) },
    );
  }

  async batchUpdate(data: { range: string; values: Cell[][] }[]): Promise<void> {
    await this.request(this.url("/values:batchUpdate"), {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "RAW", data }),
    });
  }
}

/** Builds a client authenticated as the service account. */
export function createSheetsClient(spreadsheetId: string, credentials: ServiceAccountCredentials): SheetsClient {
  const jwt = new JWT({ email: credentials.client_email, key: credentials.private_key, scopes: SCOPES });
  return new SheetsClient({
    spreadsheetId,
    getAccessToken: async () => {
      const { token } = await jwt.getAccessToken();
      if (!token) throw new SheetsApiError(401, "Could not obtain a Google access token for the service account.");
      return token;
    },
  });
}
