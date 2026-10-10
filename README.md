# Raven: Credit Risk Analyst Reviewer Portal

Raven is a human-in-the-loop (HITL) review dashboard for regional credit risk analysts. It is the manual
review gateway in an automated MSME credit underwriting pipeline (n8n orchestrator + Python
micro-services). Borderline applications, with a probability of default (PD) between 5.0% and 20.0%
(`application_status == 'BORDERLINE_HITL'`), are listed for review. Analysts filter them by
province and city, inspect the borrower's risk profile, and accept or reject with mandatory remarks.
Decisions are written back to the master Google Sheet and move to a view-only historical log.

The product requirements are in [`prd.md`](prd.md); agent working conventions are in
[`CLAUDE.md`](CLAUDE.md).

> **Status: scaffold only.** The project structure, configuration, data-access interfaces and a
> sample-data adapter exist. The UI views, decision workflow and live Google Sheets integration are
> not implemented yet (see [What is not implemented](#what-is-not-implemented)).

## Tech stack

| Area | Choice |
| --- | --- |
| Runtime | Node.js 22 (≥ 22.12), npm ≥ 11.20 |
| Framework | Next.js 16.3.8 (App Router), React 19.3.0 |
| Language | TypeScript 5.9.3 (strict) |
| Tests | Vitest 5.0.2 |
| Lint | ESLint 9.39.5 with `eslint-config-next` 16.3.8 |
| Data store | Google Sheets (master sheet, read and write-back), integration pending |

All dependency versions are pinned exactly in `package.json` and locked in `package-lock.json`.

## Folder structure

```
.
├── CLAUDE.md                       # Agent working conventions
├── prd.md                          # Product requirements (source of truth)
├── README.md
├── .env.example                    # Template for local config (copy to .env.local)
├── .gitignore                      # Ignores .env*, secrets/, build output
├── .nvmrc                          # Node major version (22)
├── eslint.config.mjs
├── next.config.ts
├── package.json / package-lock.json
├── tsconfig.json
├── vitest.config.mts
├── fixtures/
│   └── applications.sample.json    # Fictional, pre-masked sample rows (3 pending, 2 decided)
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx                # Placeholder shell (tabs not built)
│   │   ├── globals.css             # PRD §8 palette as CSS variables
│   │   └── api/
│   │       ├── applications/route.ts   # GET ?view=incoming|accepted|rejected
│   │       └── decisions/route.ts      # POST placeholder, returns 501
│   ├── config/
│   │   └── env.ts                  # Loads and validates environment configuration (server-only)
│   ├── domain/
│   │   ├── types.ts                # PRD §5 payload types
│   │   └── status.ts               # Status constants and ACCEPT/REJECT → status map
│   └── data/                       # Data-access layer
│       ├── ports.ts                # ApplicationReader / DecisionWriter interfaces
│       ├── index.ts                # createRepositories(): picks adapter from config
│       ├── fixture/
│       │   └── fixture-repository.ts   # In-memory adapter over fixtures/
│       └── sheets/
│           ├── sheets-repository.ts    # Google Sheets adapter (placeholder, throws NotImplementedError)
│           └── column-map.ts           # Field → sheet header mapping (placeholder)
└── tests/
    ├── config.test.ts
    └── repositories.test.ts
```

### Data-access design

UI code and route handlers depend only on the two interfaces in `src/data/ports.ts`:

- `ApplicationReader`: `listIncoming()` and `listHistorical("accepted" | "rejected")`
- `DecisionWriter`: `submitDecision(decision)`

`createRepositories()` in `src/data/index.ts` selects the implementation from `RAVEN_DATA_SOURCE`:

- `fixture` (default): `FixtureApplicationRepository`, backed by `fixtures/applications.sample.json`.
- `sheets`: `SheetsApplicationRepository`, which reads from and writes back to the same spreadsheet
  (`GOOGLE_SHEETS_SPREADSHEET_ID`). Every method currently throws `NotImplementedError`, which the
  API turns into HTTP 501.

Credentials are read only on the server (route handlers), never in client components.

## Prerequisites

- **Node.js 22.12 or newer within 22.x** (`nvm use` reads `.nvmrc`).
- **npm 11.20 or newer.** Node 22 ships with npm 10, which crashes while installing Vitest 5's peer
  dependencies (`Cannot read properties of null (reading 'edgesOut')`). Upgrade with:
  ```bash
  npm install -g npm@11.20.0
  ```
- **For the later Google Sheets integration** (not needed to run the scaffold):
  1. A Google Cloud project with the **Google Sheets API** enabled.
  2. A **service account** and its JSON key. Save it as `secrets/google-service-account.json`
     (the `secrets/` folder is git-ignored).
  3. Share the master Google Sheet with the service account's email address as **Editor**.
  4. Note the spreadsheet ID from the sheet URL: `https://docs.google.com/spreadsheets/d/<ID>/edit`.

  A Google **API key alone is not enough**: API keys can only read publicly shared sheets and cannot
  write. `GOOGLE_SHEETS_API_KEY` is kept as an optional read-only setting.

## Configuration

Copy the template and edit it. `.env.local` is git-ignored; never commit real IDs or keys.

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `RAVEN_DATA_SOURCE` | no (default `fixture`) | `fixture` or `sheets` |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | when `sheets` | Master sheet ID (read and write-back) |
| `GOOGLE_APPLICATION_CREDENTIALS` | when `sheets` | Path to the service-account JSON key |
| `GOOGLE_SHEETS_APPLICATIONS_TAB` | no (default `Applications`) | Worksheet with application rows |
| `GOOGLE_SHEETS_API_KEY` | no | Optional read-only API key |
| `RAVEN_ANALYST_ID` | no (default `ANALYST_LOCAL_01`) | Analyst ID on decisions until auth exists |

With `RAVEN_DATA_SOURCE=sheets`, the app fails fast with a `ConfigError` naming any missing
required variable.

## Commands

```bash
npm ci              # install the exact locked dependencies
npm run dev         # dev server at http://localhost:3000
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest unit tests (run once)
npm run build       # production build
npm run start       # serve the production build (run `npm run build` first)
```

All of these were run against this scaffold and pass with no warnings. What you can exercise today:

```bash
curl http://localhost:3000/api/applications                 # 3 pending sample rows
curl "http://localhost:3000/api/applications?view=accepted" # decided sample rows
curl "http://localhost:3000/api/applications?view=rejected"
curl -X POST http://localhost:3000/api/decisions            # 501: write-back not implemented
```

With `RAVEN_DATA_SOURCE=sheets` and the required variables set, `/api/applications` returns 501
because the Sheets adapter is a placeholder.

## What is not implemented

- Tab 1 and Tab 2 UI: tables, province/city filter bar, search, review drawer, restructuring badge.
- Decision flow: remarks validation, status transition, write-back and moving rows to Historical.
- PII masking logic (sample data is already masked).
- Google Sheets read and write-back (`src/data/sheets/`).
- Analyst authentication.
