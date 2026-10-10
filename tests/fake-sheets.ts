import type { Cell } from "@/data/sheets/header-map";

/** In-memory stand-in for the Sheets v4 values API, enough for SheetsClient's calls. */
export class FakeSheets {
  requests: { method: string; url: string; body?: unknown }[] = [];
  failNext: number[] = [];
  failUpdates = false;

  constructor(public tabs: Record<string, Cell[][]>) {}

  private parseRange(range: string): { tab: string; cell?: { col: number; row: number }; headerOnly: boolean } {
    const match = /^'((?:[^']|'')+)'(?:!(.+))?$/.exec(range);
    if (!match) throw new Error(`Bad range ${range}`);
    const tab = match[1].replace(/''/g, "'");
    const ref = match[2];
    if (!ref) return { tab, headerOnly: false };
    if (ref === "1:1") return { tab, headerOnly: true };
    const cell = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!cell) throw new Error(`Bad ref ${ref}`);
    const col = [...cell[1]].reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    return { tab, cell: { col, row: Number(cell[2]) }, headerOnly: false };
  }

  fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    this.requests.push({ method: init?.method ?? "GET", url: url.toString(), body });
    const status = this.failNext.shift();
    if (status) return new Response("boom", { status });

    if (url.pathname.endsWith("/values:batchGet")) {
      const valueRanges = url.searchParams.getAll("ranges").map((range) => {
        const { tab, headerOnly } = this.parseRange(range);
        const rows = this.tabs[tab] ?? [];
        return { values: headerOnly ? rows.slice(0, 1) : rows };
      });
      return Response.json({ valueRanges });
    }
    if (url.pathname.endsWith(":append")) {
      const range = decodeURIComponent(url.pathname.split("/values/")[1].replace(/:append$/, ""));
      this.tabs[this.parseRange(range).tab].push(...body.values);
      return Response.json({});
    }
    if (url.pathname.endsWith("/values:batchUpdate")) {
      if (this.failUpdates) return new Response("permission denied", { status: 403 });
      for (const { range, values } of body.data as { range: string; values: Cell[][] }[]) {
        const { tab, cell } = this.parseRange(range);
        const row = this.tabs[tab][cell!.row - 1];
        while (row.length <= cell!.col) row.push("");
        row[cell!.col] = values[0][0];
      }
      return Response.json({});
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}
