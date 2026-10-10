import { describe, expect, it } from "vitest";
import { asNumber, columnLetter, parseTable, quoteTab, SheetSchemaError } from "@/data/sheets/header-map";

describe("parseTable", () => {
  it("maps cells by header name regardless of column order and skips blank rows", () => {
    const table = parseTable("t", [[" City ", "borrower_id"], ["Palu", "B1"], ["", ""], ["Manado", "B2"]], ["borrower_id", "city"]);
    expect(table.rows.map((row) => [row.rowNumber, row.get("borrower_id"), row.get("city")])).toEqual([
      [2, "B1", "Palu"],
      [4, "B2", "Manado"],
    ]);
  });

  it("names every missing required column", () => {
    expect(() => parseTable("applications", [["borrower_id"]], ["borrower_id", "city", "nik"])).toThrow(
      new SheetSchemaError('Tab "applications" is missing required column(s): city, nik.'),
    );
  });
});

describe("helpers", () => {
  it("converts column indexes to A1 letters", () => {
    expect([0, 25, 26, 51, 701, 702].map(columnLetter)).toEqual(["A", "Z", "AA", "AZ", "ZZ", "AAA"]);
  });
  it("quotes tab names", () => {
    expect(quoteTab("raven reviews")).toBe("'raven reviews'");
    expect(quoteTab("O'Neil")).toBe("'O''Neil'");
  });
  it("parses numbers, formatted numbers and percentages", () => {
    expect(asNumber(0.1)).toBe(0.1);
    expect(asNumber("250,000,000")).toBe(250000000);
    expect(asNumber("10%")).toBeCloseTo(0.1);
    expect(asNumber("n/a")).toBeNaN();
    expect(asNumber("")).toBeNaN();
  });
});
