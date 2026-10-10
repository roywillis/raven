import { describe, expect, it } from "vitest";
import { applyFilters, cityOptions, counterLabel, EMPTY_FILTERS, provinceOptions, withProvinces } from "@/domain/filters";
import { toApplicationView } from "@/domain/review";
import { makeApp } from "./helpers";

const rows = [
  makeApp({ borrower_id: "BOR-0026", province: "Jawa Timur", city: "Surabaya", business_name: "Distributor Sayur" }),
  makeApp({ borrower_id: "BOR-0010", province: "Jawa Timur", city: "Malang", business_name: "Dapur Bu Hartini" }),
  makeApp({ borrower_id: "BOR-0019", province: "Sulawesi Selatan", city: "Makassar", business_name: "Bengkel Las" }),
  makeApp({ borrower_id: "BOR-0022", province: "Sulawesi Tengah", city: "Palu", business_name: "Kerajinan Kayu" }),
].map(toApplicationView);

describe("Story 1: filter pending applications by Province/City", () => {
  it("populates provinces from the dataset, keeping Sulawesi Selatan and Tengah separate", () => {
    expect(provinceOptions(rows)).toEqual(["Jawa Timur", "Sulawesi Selatan", "Sulawesi Tengah"]);
  });

  it("filters to one province and labels the counter", () => {
    const filters = withProvinces(EMPTY_FILTERS, ["Jawa Timur"], rows);
    const visible = applyFilters(rows, filters);
    expect(visible.map((row) => row.borrower_id)).toEqual(["BOR-0026", "BOR-0010"]);
    expect(counterLabel(visible.length, filters)).toBe("Showing 2 Pending Applications for Jawa Timur");
  });

  it("supports multi-select provinces and narrows city options to them", () => {
    expect(cityOptions(rows, ["Jawa Timur", "Sulawesi Tengah"])).toEqual(["Malang", "Palu", "Surabaya"]);
    const filters = withProvinces(EMPTY_FILTERS, ["Jawa Timur", "Sulawesi Tengah"], rows);
    expect(applyFilters(rows, filters)).toHaveLength(3);
  });

  it("drops selected cities that no longer belong to the selected provinces", () => {
    const filters = { ...EMPTY_FILTERS, provinces: ["Jawa Timur"], cities: ["Surabaya", "Malang"] };
    expect(withProvinces(filters, ["Sulawesi Selatan"], rows).cities).toEqual([]);
    expect(withProvinces(filters, ["Jawa Timur", "Sulawesi Selatan"], rows).cities).toEqual(["Surabaya", "Malang"]);
  });

  it("filters by city and by search on ID or business name (case-insensitive)", () => {
    expect(applyFilters(rows, { ...EMPTY_FILTERS, cities: ["Palu"] }).map((row) => row.borrower_id)).toEqual(["BOR-0022"]);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, search: "bor-0019" })).toHaveLength(1);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, search: "kayu" })).toHaveLength(1);
  });

  it("reset (empty filters) shows all pending records", () => {
    expect(applyFilters(rows, EMPTY_FILTERS)).toHaveLength(4);
    expect(counterLabel(4, EMPTY_FILTERS)).toBe("Showing 4 Pending Applications for All Provinces");
    expect(counterLabel(1, { ...EMPTY_FILTERS, cities: ["Palu"] })).toBe("Showing 1 Pending Application for Palu");
  });
});
