import { describe, expect, it } from "vitest";
import type { SheetsConfig } from "@/config/env";
import { createRepositories, NotImplementedError } from "@/data";
import { FixtureApplicationRepository } from "@/data/fixture/fixture-repository";
import { SheetsApplicationRepository } from "@/data/sheets/sheets-repository";
import type { DecisionPayload } from "@/domain/types";

const sheetsConfig: SheetsConfig = {
  spreadsheetId: "sheet-123",
  credentialsPath: "./secrets/key.json",
  applicationsTab: "Applications",
};

const decision: DecisionPayload = {
  borrower_id: "BOR-0026",
  analyst_id: "ANALYST_SURABAYA_01",
  action: "ACCEPT",
  updated_status: "APPROVED_HITL",
  remarks: "Verified 6-month bank statements.",
  timestamp: "2026-10-09T23:25:00Z",
};

describe("createRepositories", () => {
  it("uses the fixture adapter in fixture mode", () => {
    const { reader, writer } = createRepositories({ dataSource: "fixture", analystId: "A" });
    expect(reader).toBeInstanceOf(FixtureApplicationRepository);
    expect(writer).toBe(reader);
  });

  it("uses the Sheets adapter in sheets mode", () => {
    const { reader } = createRepositories({ dataSource: "sheets", analystId: "A", sheets: sheetsConfig });
    expect(reader).toBeInstanceOf(SheetsApplicationRepository);
  });
});

describe("FixtureApplicationRepository", () => {
  const repo = new FixtureApplicationRepository();

  it("lists only BORDERLINE_HITL rows as incoming", async () => {
    const rows = await repo.listIncoming();
    expect(rows.map((r) => r.borrower_id)).toEqual(["BOR-0026", "BOR-0010", "BOR-0014"]);
  });

  it("splits historical rows into accepted and rejected", async () => {
    expect((await repo.listHistorical("accepted")).map((r) => r.borrower_id)).toEqual(["BOR-0003"]);
    expect((await repo.listHistorical("rejected")).map((r) => r.borrower_id)).toEqual(["BOR-0031"]);
  });

  it("does not implement write-back yet", async () => {
    await expect(repo.submitDecision(decision)).rejects.toBeInstanceOf(NotImplementedError);
  });
});

describe("SheetsApplicationRepository (placeholder)", () => {
  const repo = new SheetsApplicationRepository(sheetsConfig);

  it("throws NotImplementedError for every operation", async () => {
    await expect(repo.listIncoming()).rejects.toBeInstanceOf(NotImplementedError);
    await expect(repo.listHistorical("accepted")).rejects.toBeInstanceOf(NotImplementedError);
    await expect(repo.submitDecision(decision)).rejects.toBeInstanceOf(NotImplementedError);
  });
});
