"use client";

import { PAGE_SIZE_OPTIONS, pageWindow, type Page } from "@/domain/pagination";

interface PaginationProps {
  page: Page<unknown>;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** e.g. "applications"; used in the range text and labels. */
  noun: string;
}

/** Table footer: row range, page buttons and rows-per-page. */
export function Pagination({ page, pageSize, onPageChange, onPageSizeChange, noun }: PaginationProps) {
  if (page.total === 0) return null;

  return (
    <div className="pagination">
      <p className="pagination-range" aria-live="polite">
        Showing {page.from}–{page.to} of {page.total} {noun}
      </p>

      <nav className="pagination-pages" aria-label={`${noun} pages`}>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => onPageChange(page.page - 1)}
          disabled={page.page <= 1}
          aria-label="Previous page"
        >
          ‹ Prev
        </button>
        {pageWindow(page.page, page.pageCount).map((item, index) =>
          item === "…" ? (
            <span key={`gap-${index}`} className="pagination-gap" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={item === page.page ? "btn btn-small pagination-current" : "btn btn-ghost btn-small"}
              onClick={() => onPageChange(item)}
              aria-current={item === page.page ? "page" : undefined}
              aria-label={`Page ${item}`}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => onPageChange(page.page + 1)}
          disabled={page.page >= page.pageCount}
          aria-label="Next page"
        >
          Next ›
        </button>
      </nav>

      <label className="pagination-size">
        <span>Rows per page</span>
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
