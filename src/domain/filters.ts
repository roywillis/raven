import type { ApplicationView } from "./types";

/** Incoming-tab filter state (prd.md §4). Empty arrays mean "all". */
export interface IncomingFilters {
  provinces: string[];
  cities: string[];
  search: string;
}

export const EMPTY_FILTERS: IncomingFilters = { provinces: [], cities: [], search: "" };

const sortedUnique = (values: string[]) =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

/** Province options come from the dataset itself. */
export function provinceOptions(rows: ApplicationView[]): string[] {
  return sortedUnique(rows.map((row) => row.province));
}

/** City options narrow to the selected provinces (all cities when none is selected). */
export function cityOptions(rows: ApplicationView[], provinces: string[]): string[] {
  const inScope = provinces.length === 0 ? rows : rows.filter((row) => provinces.includes(row.province));
  return sortedUnique(inScope.map((row) => row.city));
}

/** Keeps only selected cities that still belong to the selected provinces. */
export function withProvinces(filters: IncomingFilters, provinces: string[], rows: ApplicationView[]): IncomingFilters {
  const allowed = new Set(cityOptions(rows, provinces));
  return { ...filters, provinces, cities: filters.cities.filter((city) => allowed.has(city)) };
}

export function applyFilters(rows: ApplicationView[], filters: IncomingFilters): ApplicationView[] {
  const query = filters.search.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (filters.provinces.length === 0 || filters.provinces.includes(row.province)) &&
      (filters.cities.length === 0 || filters.cities.includes(row.city)) &&
      (query === "" ||
        row.borrower_id.toLowerCase().includes(query) ||
        row.business_name.toLowerCase().includes(query)),
  );
}

/** "Showing 2 Pending Applications for Jawa Timur" (prd.md Story 1). */
export function counterLabel(count: number, filters: IncomingFilters): string {
  const scope =
    filters.cities.length > 0
      ? filters.cities.join(", ")
      : filters.provinces.length > 0
        ? filters.provinces.join(", ")
        : "All Provinces";
  return `Showing ${count} Pending Application${count === 1 ? "" : "s"} for ${scope}`;
}
