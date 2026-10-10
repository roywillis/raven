/** Client-side pagination for the dashboard tables. Pages are 1-based. */

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE: number = PAGE_SIZE_OPTIONS[0];

export interface Page<T> {
  items: T[];
  /** Current page, clamped to 1..pageCount (rows can disappear, e.g. after a decision). */
  page: number;
  pageCount: number;
  total: number;
  /** 1-based index of the first and last row shown (0 when there are no rows). */
  from: number;
  to: number;
}

export function paginate<T>(rows: readonly T[], page: number, pageSize: number): Page<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (current - 1) * size;
  const items = rows.slice(start, start + size);
  return {
    items,
    page: current,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: start + items.length,
  };
}

/**
 * Page numbers to show as buttons, with "…" gaps for long ranges:
 * always the first and last page, plus the current page and its neighbours.
 * e.g. pageWindow(6, 12) → [1, "…", 5, 6, 7, "…", 12]
 */
export function pageWindow(current: number, pageCount: number, neighbours = 1): (number | "…")[] {
  // Up to 7 pages (with 1 neighbour) fit without gaps, so show them all.
  if (pageCount <= 2 * neighbours + 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const pages = new Set<number>([1, pageCount]);
  for (let page = current - neighbours; page <= current + neighbours; page++) {
    if (page >= 1 && page <= pageCount) pages.add(page);
  }
  // Avoid a lone gap of a single page: show it instead of "…".
  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && page - previous === 2) result.push(previous + 1);
    else if (previous !== undefined && page - previous > 2) result.push("…");
    result.push(page);
  });
  return result;
}
