# Raven: Credit Risk Analyst Reviewer Portal

Raven is a human-in-the-loop (HITL) review dashboard for regional credit risk analysts. It is the manual
review gateway in an automated MSME credit underwriting pipeline (n8n orchestrator + Python
micro-services). Borderline applications, with a probability of default (PD) between 5.0% and 20.0%
(`application_status == 'BORDERLINE_HITL'`), are listed for review. Analysts filter them by province and
city, inspect the borrower's risk profile, and accept (one click + confirm) or reject (with mandatory
remarks). Each decision is logged in Raven's own review log, mirrored back to the master Google Sheet, and
shown in a view-only history.

Product requirements: [`prd.md`](prd.md) (v2.1). Agent working conventions: [`CLAUDE.md`](CLAUDE.md).

## Tech stack

| Area | Choice |
| --- | --- |
| Runtime | Node.js 22 (≥ 22.12), npm ≥ 11.20 |
| Framework | Next.js 16.3.8 (App Router), React 19.3.0 |
| Language | TypeScript 5.9.3 (strict) |
| Auth | next-auth 4.24.15 (Google sign-in, JWT sessions) |
| Google Sheets | Sheets REST API v4 via `google-auth-library` 11.1.0 (service account) |
| Tests | Vitest 5.0.2 |
| Lint | ESLint 9.39.5 with `eslint-config-next` 16.3.8 |

All dependency versions are pinned exactly in `package.json` and locked in `package-lock.json`.

## How it works

```
                    ┌──────────── one Google Sheet ────────────┐
 n8n workflow ────► │ applications   (master; Raven writes only │
                    │                 its 5 review columns)     │
                    │ raven_reviews  (Raven-owned, append-only) │ ◄──── Raven (service account)
                    │ raven_users    (pre-registered users)     │
                    └───────────────────────────────────────────┘
```

- **Pending** = `application_status == BORDERLINE_HITL` and no review logged yet.
- **Deciding** (`POST /api/decisions`): re-read → reject with 409 if already decided → append to
  `raven_reviews` (commit point) → update the master row's `borderline_final_review_status`,
  `reviewed_by`, `reviewed_at`, `review_remarks`, `review_id`. Loan terms are never changed.
- If the master-row update fails, the decision still stands; History shows **Sync pending** and an analyst
  can click **Re-sync now** (`POST /api/admin/resync`).
- Raw `nik` and `borrower_name` are masked on the server and never reach the browser.
- Every page and API requires an active session; decisions require the `analyst` role.

## Folder structure

```
.
├── CLAUDE.md                        # Agent working conventions
├── prd.md                           # Product requirements (source of truth)
├── README.md
├── .env.example                     # Template for local config (copy to .env.local)
├── .gitignore                       # Ignores .env*, secrets/, build output
├── .nvmrc                           # Node major version (22)
├── eslint.config.mjs
├── next.config.ts
├── package.json / package-lock.json
├── tsconfig.json
├── vitest.config.mts / vitest.live.config.mts
├── fixtures/
│   ├── applications.sample.json     # Fictional sample rows in the real sheet columns
│   └── users.sample.json            # Sample users (analyst, viewer, deactivated)
├── src/
│   ├── proxy.ts                     # Sign-in gate for all pages and APIs (Next 16 "proxy")
│   ├── app/
│   │   ├── layout.tsx, globals.css, icon.svg
│   │   ├── page.tsx                 # Portal (server-loads the queue for the signed-in user)
│   │   ├── signin/page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── applications/route.ts    # GET queue + history (masked)
│   │       ├── decisions/route.ts       # POST decision (analyst only)
│   │       └── admin/resync/route.ts    # POST re-sync master rows (analyst only)
│   ├── auth/                        # next-auth options, session/role checks, error responses
│   ├── components/                  # Portal UI: tabs, filters, drawer, history, sign-in
│   ├── config/env.ts                # Loads and validates environment configuration
│   ├── domain/                      # Types, statuses, masking, review rules, filters (pure logic)
│   ├── services/review-service.ts   # Decision workflow, duplicate protection, re-sync
│   ├── types/next-auth.d.ts
│   └── data/                        # Data-access layer
│       ├── ports.ts                 # ApplicationReader / ReviewStore / UserDirectory interfaces
│       ├── index.ts                 # Picks the adapter from RAVEN_DATA_SOURCE
│       ├── fixture/                 # In-memory adapter over fixtures/ (local dev, tests)
│       └── sheets/                  # Google Sheets adapter: REST client, header mapping, schema, check
└── tests/                           # Vitest unit and route tests; tests/live/ = check:sheets
```

## Prerequisites

- **Node.js 22.12 or newer within 22.x** (`nvm use` reads `.nvmrc`).
- **npm 11.20 or newer.** Node 22 ships with npm 10, which crashes while installing Vitest 5's peer
  dependencies (`Cannot read properties of null (reading 'edgesOut')`). Upgrade with:
  ```bash
  npm install -g npm@11.20.0
  ```

### Google setup (for the real sheet and Google sign-in)

1. **Google Cloud project** with the **Google Sheets API** enabled.
2. **Service account** (for reading and writing the sheet): create one, create a JSON key, and share the
   spreadsheet with the service account's `client_email` as **Editor**. Put the key JSON in
   `GOOGLE_SERVICE_ACCOUNT_JSON` (raw single-line JSON or base64).
3. **OAuth client** (for analyst sign-in only): create an OAuth client ID of type *Web application* with
   the redirect URI `<NEXTAUTH_URL>/api/auth/callback/google`. Put its ID and secret in
   `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`.
4. **Sheet tabs** (row 1 = headers; column order does not matter; names are configurable):
   - `applications`: `borrower_id, nik, borrower_name, business_name, business_type, province, city,
     credit_score, tenor_months, monthly_income_idr, loan_amount_granted, application_status, pd_score,
     decision_notes, borderline_final_review_status, reviewed_by, reviewed_at, review_remarks, review_id`
     (the n8n workflow must fill `city`; the last five are written by Raven only).
   - `raven_reviews`: `review_id, borrower_id, action, final_status, remarks, analyst_email, decided_at,
     pd_score, loan_amount_granted, tenor_months` (headers only; Raven appends rows).
   - `raven_users`: `email, display_name, role, active` (role `analyst` or `viewer`; active `TRUE`/`FALSE`).

If a required column is missing, Raven shows an error naming the tab and column instead of loading.

Header rows ready to paste into cell A1 of each tab (tab-separated, so Google Sheets splits them into
columns). For `applications`, paste the five Raven columns into the first empty cells of row 1:

```text
borderline_final_review_status	reviewed_by	reviewed_at	review_remarks	review_id
```
```text
review_id	borrower_id	action	final_status	remarks	analyst_email	decided_at	pd_score	loan_amount_granted	tenor_months
```
```text
email	display_name	role	active
```

### Check the live sheet (read-only)

```bash
npm run check:sheets
```

Uses `GOOGLE_SHEETS_SPREADSHEET_ID` and `GOOGLE_SERVICE_ACCOUNT_JSON` from the environment or
`.env.local` (no sign-in settings needed). It authenticates as the service account, then checks that
each tab exists with the required headers. It reports unrecognised headers, unreadable rows,
duplicate borrower IDs, empty cities, unknown statuses and whether an active analyst exists. It writes
nothing, prints no NIKs or names, and does not test write access. It exits non-zero while there are
blocking problems. It is not part of `npm test`.

## Configuration

```bash
cp .env.example .env.local     # git-ignored; never commit real values
openssl rand -base64 32        # paste the output into NEXTAUTH_SECRET
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `RAVEN_DATA_SOURCE` | no (default `fixture`) | `fixture` (sample data) or `sheets` |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | when `sheets` | Master spreadsheet ID |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | when `sheets` | Service-account key (raw JSON or base64) |
| `RAVEN_TAB_APPLICATIONS` / `RAVEN_TAB_REVIEWS` / `RAVEN_TAB_USERS` | no | Tab names (defaults `applications`, `raven_reviews`, `raven_users`) |
| `NEXTAUTH_SECRET` | yes | Session signing key, ≥ 32 characters |
| `NEXTAUTH_URL` | yes in production, except on Vercel | Public base URL (OAuth redirects). On Vercel it is detected automatically |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | yes, unless dev sign-in | Google sign-in |
| `RAVEN_DEV_SIGNIN` | no | `true` = sign in as a sample user without Google. Allowed only with `fixture` data outside production |

The app fails fast with a message naming any missing or unsafe setting.

## Commands

```bash
npm ci              # install the exact locked dependencies
npm run dev         # dev server at http://localhost:3000 (needs .env.local, see below)
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest unit and route tests (run once)
npm run check:sheets  # read-only check of the live Google Sheet (needs Sheets credentials)
npm run build       # production build (no environment needed at build time)
npm run start       # serve the production build (needs Google sign-in config)
```

### Run locally with sample data (no Google account needed)

In `.env.local`:

```bash
RAVEN_DATA_SOURCE=fixture
NEXTAUTH_SECRET=<output of openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
RAVEN_DEV_SIGNIN=true
```

Then `npm run dev`, open http://localhost:3000 and pick a sample user (`analyst@raven.local`,
`viewer@raven.local`, or the deactivated `former@raven.local`). Decisions are kept in memory and reset when
the server restarts. `npm run start` refuses dev sign-in (production mode), so it needs the Google OAuth
settings.

### Run against the real sheet

Set `RAVEN_DATA_SOURCE=sheets`, the spreadsheet ID, service-account JSON, OAuth client and
`NEXTAUTH_URL`, leave `RAVEN_DEV_SIGNIN` unset, then `npm run build && npm run start`.

### Deploy on Vercel

1. In Vercel: **Add New → Project → Import** `roywillis/raven`. The Next.js defaults (build command,
   output, Node 22 from `package.json`) need no changes.
2. Add these environment variables (Production and Preview), marking the secret ones **Sensitive**:

   | Variable | Value |
   | --- | --- |
   | `RAVEN_DATA_SOURCE` | `sheets` |
   | `GOOGLE_SHEETS_SPREADSHEET_ID` | the spreadsheet ID |
   | `GOOGLE_SERVICE_ACCOUNT_JSON` | the whole downloaded key file, pasted as-is (or base64) |
   | `NEXTAUTH_SECRET` | 32+ random characters (`openssl rand -base64 32`) |
   | `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | from the OAuth client |

   Leave `NEXTAUTH_URL` and `RAVEN_DEV_SIGNIN` unset (dev sign-in is always refused on Vercel).
3. In the Google OAuth client, add the deployment URL as an authorized JavaScript origin and
   `<URL>/api/auth/callback/google` as an authorized redirect URI. Use a stable URL: the production
   domain, or a branch's preview alias. Per-commit preview URLs change on every push.
4. After changing environment variables, redeploy so they take effect.

Vercel can run several server instances at once, so the in-process lock does not span them. The
re-read before each decision still rejects most double decisions. If two land within the same moment,
the earliest one counts and the other is reported as a data issue in the portal.

## Verification status

- `npm ci`, `lint`, `typecheck`, `test` and `build` pass with no warnings.
- The full flow was exercised in Chromium against the sample data with dev sign-in: filters, reject
  validation, accept/reject, history, duplicate-decision 409, viewer 403, deactivated-user denial,
  phone-width layout.
- `npm run check:sheets` ran against the real spreadsheet: service-account authentication and reads
  work. Writes and real Google sign-in have not been exercised yet. The Sheets adapter's writes are
  tested against an in-memory fake of the Sheets API.
