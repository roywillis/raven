import { getConfig, type AppConfig } from "@/config/env";
import { FixtureRepository } from "./fixture/fixture-repository";
import type { Repositories } from "./ports";
import { createSheetsClient } from "./sheets/client";
import { SheetsRepository } from "./sheets/sheets-repository";

export * from "./ports";

/** Builds the data adapters for the configured data source. Server-side only. */
export function createRepositories(config: AppConfig): Repositories {
  if (config.dataSource === "sheets") {
    const { spreadsheetId, credentials, tabs } = config.sheets!;
    const repository = new SheetsRepository(createSheetsClient(spreadsheetId, credentials), tabs);
    return { applications: repository, reviews: repository, users: repository };
  }
  const repository = new FixtureRepository();
  return { applications: repository, reviews: repository, users: repository };
}

// Kept on globalThis so the fixture store survives dev-server hot reloads.
const holder = globalThis as typeof globalThis & { __ravenRepositories?: Repositories };

/** Process-wide repositories for the current configuration. */
export function getRepositories(): Repositories {
  holder.__ravenRepositories ??= createRepositories(getConfig());
  return holder.__ravenRepositories;
}
