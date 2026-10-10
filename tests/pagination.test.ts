import { describe, expect, it } from "vitest";
import { pageWindow, paginate } from "@/domain/pagination";

const rows = Array.from({ length: 23 }, (_, index) => index + 1);

describe("paginate", () => {
  it("returns the requested page and its row range", () => {
    expect(paginate(rows, 1, 10)).toMatchObject({ items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], page: 1, pageCount: 3, total: 23, from: 1, to: 10 });
    expect(paginate(rows, 3, 10)).toMatchObject({ items: [21, 22, 23], page: 3, from: 21, to: 23 });
  });

  it("clamps the page when rows disappear or the page is out of range", () => {
    expect(paginate(rows.slice(0, 15), 3, 10)).toMatchObject({ page: 2, items: [11, 12, 13, 14, 15] });
    expect(paginate(rows, 0, 10).page).toBe(1);
    expect(paginate(rows, Number.NaN, 10).page).toBe(1);
  });

  it("handles an empty table", () => {
    expect(paginate([], 1, 10)).toEqual({ items: [], page: 1, pageCount: 1, total: 0, from: 0, to: 0 });
  });

  it("supports larger page sizes", () => {
    expect(paginate(rows, 1, 25)).toMatchObject({ pageCount: 1, from: 1, to: 23 });
  });
});

describe("pageWindow", () => {
  it("shows every page when there are 7 or fewer", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("collapses long ranges around the current page", () => {
    expect(pageWindow(1, 12)).toEqual([1, 2, "…", 12]);
    expect(pageWindow(6, 12)).toEqual([1, "…", 5, 6, 7, "…", 12]);
    expect(pageWindow(12, 12)).toEqual([1, "…", 11, 12]);
  });

  it("shows a single skipped page instead of a gap", () => {
    expect(pageWindow(4, 12)).toEqual([1, 2, 3, 4, 5, "…", 12]);
  });
});
