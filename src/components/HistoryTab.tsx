"use client";

import { useState } from "react";
import { DEFAULT_PAGE_SIZE, paginate } from "@/domain/pagination";
import type { HistoryView } from "@/domain/types";
import { formatDateTime } from "./format";
import { Pagination } from "./Pagination";

interface HistoryTabProps {
  accepted: HistoryView[];
  rejected: HistoryView[];
}

/** View-only log (prd.md Story 3): no inputs or action buttons besides the sub-tab switch. */
export function HistoryTab({ accepted, rejected }: HistoryTabProps) {
  const [view, setViewState] = useState<"accepted" | "rejected">("accepted");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const rows = view === "accepted" ? accepted : rejected;
  const page = paginate(rows, pageNumber, pageSize);

  // Switching sub-tab starts again from the first page.
  const setView = (next: "accepted" | "rejected") => {
    setViewState(next);
    setPageNumber(1);
  };

  return (
    <section aria-label="Historical applications">
      <div className="subtabs" role="tablist">
        <button type="button" role="tab" aria-selected={view === "accepted"} onClick={() => setView("accepted")}>
          Accepted Applications ({accepted.length})
        </button>
        <button type="button" role="tab" aria-selected={view === "rejected"} onClick={() => setView("rejected")}>
          Rejected Applications ({rejected.length})
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Sector</th>
              <th>Location</th>
              <th>Status</th>
              <th>Decision date</th>
              <th>Source</th>
              <th>Analyst</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((row) => (
              <tr key={row.borrower_id}>
                <td className="mono">{row.borrower_id}</td>
                <td>
                  {row.masked_name}
                  <div className="muted small">{row.business_name}</div>
                </td>
                <td>{row.business_type}</td>
                <td>
                  {row.city}
                  <div className="muted small">{row.province}</div>
                </td>
                <td>
                  <span className={`badge ${view === "accepted" ? "badge-approved" : "badge-declined"}`}>
                    {row.final_status}
                  </span>
                  {row.sync_pending && (
                    <div>
                      <span className="badge badge-pending" title="Logged in raven_reviews; master sheet not updated yet">
                        Sync pending
                      </span>
                    </div>
                  )}
                </td>
                <td>{formatDateTime(row.decided_at)}</td>
                <td>{row.decision_source}</td>
                <td>{row.analyst_email ?? "—"}</td>
                <td className="remarks">{row.remarks || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="empty">
                  No {view} applications yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        noun={`${view} applications`}
        onPageChange={setPageNumber}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPageNumber(1);
        }}
      />
    </section>
  );
}
