"use client";

import { useMemo, useState } from "react";
import {
  applyFilters,
  cityOptions,
  counterLabel,
  EMPTY_FILTERS,
  provinceOptions,
  withProvinces,
  type IncomingFilters,
} from "@/domain/filters";
import { DEFAULT_PAGE_SIZE, paginate } from "@/domain/pagination";
import type { ApplicationView } from "@/domain/types";
import { formatRupiah } from "./format";
import { MultiSelect } from "./MultiSelect";
import { Pagination } from "./Pagination";

interface IncomingTabProps {
  rows: ApplicationView[];
  canDecide: boolean;
  onReview: (application: ApplicationView) => void;
}

export function IncomingTab({ rows, canDecide, onReview }: IncomingTabProps) {
  const [filters, setFiltersState] = useState<IncomingFilters>(EMPTY_FILTERS);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const provinces = useMemo(() => provinceOptions(rows), [rows]);
  const cities = useMemo(() => cityOptions(rows, filters.provinces), [rows, filters.provinces]);
  const visible = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const page = paginate(visible, pageNumber, pageSize);

  // Any filter change starts again from the first page.
  const setFilters = (next: IncomingFilters) => {
    setFiltersState(next);
    setPageNumber(1);
  };

  return (
    <section aria-label="Incoming applications">
      <div className="filter-bar">
        <MultiSelect
          label="Province"
          allLabel="All Provinces"
          options={provinces}
          selected={filters.provinces}
          onChange={(selected) => setFilters(withProvinces(filters, selected, rows))}
        />
        <MultiSelect
          label="City"
          allLabel="All Cities"
          options={cities}
          selected={filters.cities}
          onChange={(selected) => setFilters({ ...filters, cities: selected })}
        />
        <label className="search">
          <span className="field-label">Search</span>
          <input
            type="search"
            placeholder="Borrower ID or business"
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
          />
        </label>
        <button type="button" className="btn btn-ghost" onClick={() => setFilters(EMPTY_FILTERS)}>
          Reset Filters
        </button>
      </div>

      <p className="counter" aria-live="polite">
        {counterLabel(visible.length, filters)}
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Borrower / Business</th>
              <th>Sector</th>
              <th>Province</th>
              <th>City</th>
              <th className="num">Loan</th>
              <th className="num">PD</th>
              <th aria-label="Actions" />
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
                <td>{row.province}</td>
                <td>{row.city}</td>
                <td className="num">{formatRupiah(row.loan_amount_granted)}</td>
                <td className="num">
                  <span className="badge badge-pending">{row.pd_label}</span>
                </td>
                <td>
                  <button type="button" className="btn btn-small" onClick={() => onReview(row)}>
                    {canDecide ? "Review" : "View"}
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="empty">
                  No pending applications match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        noun="applications"
        onPageChange={setPageNumber}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPageNumber(1);
        }}
      />
    </section>
  );
}
