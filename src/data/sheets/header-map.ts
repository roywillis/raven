/**
 * Maps sheet rows to objects by header name, so column order in the sheet does not matter.
 * Row 1 of every tab is the header row.
 */

export class SheetSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetSchemaError";
  }
}

export type Cell = string | number | boolean | null | undefined;

export interface SheetRow {
  /** 1-based row number in the sheet (header is row 1). */
  rowNumber: number;
  get(header: string): Cell;
}

export interface SheetTable {
  tab: string;
  columns: Map<string, number>;
  rows: SheetRow[];
}

const normalize = (header: Cell) => String(header ?? "").trim().toLowerCase();

export function parseTable(tab: string, values: Cell[][], requiredHeaders: readonly string[]): SheetTable {
  const [headerRow = [], ...dataRows] = values;
  const columns = new Map<string, number>();
  headerRow.forEach((header, index) => {
    const name = normalize(header);
    if (name && !columns.has(name)) columns.set(name, index);
  });

  const missing = requiredHeaders.filter((header) => !columns.has(header));
  if (missing.length > 0) {
    throw new SheetSchemaError(`Tab "${tab}" is missing required column(s): ${missing.join(", ")}.`);
  }

  const rows = dataRows
    .map((cells, index) => ({
      rowNumber: index + 2,
      get: (header: string) => {
        const column = columns.get(header);
        return column === undefined ? undefined : cells[column];
      },
      empty: cells.every((cell) => normalize(cell) === ""),
    }))
    .filter((row) => !row.empty)
    .map(({ rowNumber, get }) => ({ rowNumber, get }));

  return { tab, columns, rows };
}

/** 0-based column index → A1 column letters (0 → A, 26 → AA). */
export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** Quotes a tab name for A1 notation: `raven reviews` → `'raven reviews'`. */
export function quoteTab(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}

export function asString(cell: Cell): string {
  return cell === null || cell === undefined ? "" : String(cell).trim();
}

/** Parses numbers written as numbers, plain strings or percentages ("10%" → 0.1). NaN if invalid. */
export function asNumber(cell: Cell): number {
  if (typeof cell === "number") return cell;
  const text = asString(cell).replace(/[\s,]/g, "");
  if (text === "") return Number.NaN;
  if (text.endsWith("%")) return Number(text.slice(0, -1)) / 100;
  return Number(text);
}

export function asBoolean(cell: Cell): boolean {
  if (typeof cell === "boolean") return cell;
  return ["true", "yes", "1"].includes(asString(cell).toLowerCase());
}
