import { loadConfig, type AppConfig } from "@/config/env";
import { FixtureApplicationRepository } from "./fixture/fixture-repository";
import type { ApplicationReader, DecisionWriter } from "./ports";
import { SheetsApplicationRepository } from "./sheets/sheets-repository";

export * from "./ports";

export interface Repositories {
  reader: ApplicationReader;
  writer: DecisionWriter;
}

/** Selects the data adapter from configuration. Server-side only. */
export function createRepositories(config: AppConfig = loadConfig()): Repositories {
  const repository =
    config.dataSource === "sheets"
      ? new SheetsApplicationRepository(config.sheets!)
      : new FixtureApplicationRepository();
  return { reader: repository, writer: repository };
}
