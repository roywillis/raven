# Product Requirement Document (PRD) — Project "Raven"
**Product Name:** Credit Risk Analyst Reviewer Portal (Raven)  
**Document Version:** 2.4 (credit score removed; data issues out of the UI)  
**Target Consumer:** Claude Code / Engineering Team  
**Status:** Approved for Implementation  

### Change Log
| Version | Change |
| --- | --- |
| 2.4 | `credit_score` removed from the master sheet and the review drawer. Sheet data issues (unreadable rows, duplicate borrower IDs, conflicting reviews) are no longer shown in the portal; they are written to the server logs and reported by `npm run check:sheets`. |
| 2.3 | Inter adopted as the design-system typeface for all UI text. |
| 2.2 | Light theme replaces Dark Slate Mode; status indicators are filled pills (no border) in deeper shades so white text stays readable. Review drawer slides in/out; decision notifications are a floating snackbar that auto-dismisses after 5 seconds (paused while hovered) instead of a banner that pushes the list down. |
| 2.1 | Real master-sheet columns (+ `city`); Raven-owned review log (`raven_reviews`) and user list (`raven_users`); Raven never edits loan terms; Google sign-in limited to pre-registered emails with `analyst` / `viewer` roles; multi-select Province/City filters; one-click Accept with confirmation, remarks mandatory only for Reject; Sulawesi Selatan and Sulawesi Tengah split; DTI and restructuring badge removed (no source columns). |
| 2.0 | Refined development scope. |

---

## 1. Executive Summary & Architecture Context

Project **Raven** is a Human-in-the-Loop (HITL) Credit Risk Reviewer Dashboard engineered for Regional Credit Risk Analysts. It serves as the manual review gateway in an automated MSME credit underwriting pipeline (n8n Workflow Orchestrator + Python Micro-Services).

The dashboard intercepts borderline loan applications—specifically those evaluated with a Probability of Default ($PD$) between $5.0\%$ and $20.0\%$—and provides analysts with a clean, table-based interface to filter incoming requests by location (Province/City), inspect borrower risk profiles, and execute **Accept** or **Reject** decisions (with mandatory **Remarks** on Reject). Completed decisions are recorded in Raven's own review log, mirrored back to the master Google Sheet, and shown in a view-only historical log.

---

## 2. Core Functional Scope

### In-Scope (P0 MVP Deliverables)
1. **Tab 1: Incoming Applications (Pending Borderline Review)**
   - Table view displaying pending records: `application_status == 'BORDERLINE_HITL'` ($5.0\% \le PD \le 20.0\%$) with no review recorded yet.
   - Location Filter Bar with **multi-select Province** and **City/Municipality** filters populated from dataset values, plus search by Borrower ID or business name.
   - Interactive Application Review Drawer showing the borrower's financial profile, $PD\%$, loan amount granted, tenor and the AI risk note (`decision_notes`).
   - Action Panel: **Accept** (one click + confirmation, optional remarks) and **Reject** (mandatory remarks).

2. **Tab 2: Historical Applications (View-Only Log)**
   - Categorized sub-tabs for **Accepted Applications** (`APPROVED_AUTO`, `APPROVED_HITL`) and **Rejected Applications** (`DECLINED_AUTO`, `DECLINED_HITL`).
   - Read-only table view featuring borrower metadata, decision timestamp, analyst email, decision source (STP vs HITL), and analyst remarks.

3. **Database Sync & State Management** (see §5)
   - Each decision is appended to the Raven-owned `raven_reviews` log, then mirrored to Raven's columns on the master row.
   - The reviewer never changes loan terms: `loan_amount_granted`, `tenor_months`, `application_status` and `decision_notes` are never written by Raven.
   - Automatic row transition from `Incoming` to `Historical` view once the decision is logged.

4. **Authentication & Access Control**
   - Sign in with Google; access limited to pre-registered, active emails in the `raven_users` tab.
   - Roles: `analyst` (review and decide) and `viewer` (view-only, e.g. Credit Operations Manager / Auditor).
   - Territory assignment is managed by SOP (no per-analyst territory restriction in the MVP).

### Out-of-Scope (Explicit Non-Goals)
- Real-time API integration with central bank credit bureaus (SLIK/Pefindo).
- Automated OCR scanning of paper cash diaries.
- Automated debt collection or post-disbursement borrower chat messaging.
- Editing loan terms (amount, tenor) during review.
- Multiple concurrent loans per borrower (MVP: one loan per `borrower_id`).

---

## 3. UI Layout & Component Architecture

```
+-----------------------------------------------------------------------------------+
|  RAVEN REVIEWER PORTAL (Light Mode: #F8FAFC)               Analyst Name [Sign out] |
|                                                                                   |
|  [ TAB 1: INCOMING APPLICATIONS (3) ]   |   [ TAB 2: HISTORICAL APPLICATIONS ]    |
|  ==============================================================================   |
|                                                                                   |
|  FILTER BAR:                                                                      |
|  [ Province: Jawa Timur, +1 v ] [ City: All Cities v ] [ Search ID/Business ] [Reset Filters] |
|  Showing 3 Pending Applications for Jawa Timur, Sulawesi Utara                     |
|  -------------------------------------------------------------------------------  |
|                                                                                   |
|  INCOMING APPLICATIONS TABLE                                                      |
|  | ID       | Borrower / Business | Sector     | Province   | City   | PD (%) | Actions |
|  |----------|---------------------|------------|------------|--------|--------|---------|
|  | BOR-0026 | A*** G*** (Sayur)   | Pertanian  | Jawa Timur | Surabaya | 10.00% | [Review] |
|  | BOR-0010 | M*** H*** (Dapur)   | Kuliner    | Jawa Timur | Malang   | 14.50% | [Review] |
|  | BOR-0014 | R*** S*** (Toko)    | Perdagangan| Sulawesi Utara | Manado | 18.20% | [Review] |
|                                                                                   |
+-----------------------------------------------------------------------------------+
|  REVIEW & ACTION DRAWER (When row is selected)                                   |
|  -------------------------------------------------------------------------------  |
|  Applicant: A*** G*** | NIK: 3578****0020 | PD: 10.00%                             |
|  Loan amount granted: Rp 250.000.000 (12m) | Monthly income: Rp 90.000.000          |
|  AI Risk Note: Moderate risk. Requires off-take verification.                      |
|                                                                                   |
|  ANALYST DECISION:                                                                |
|  [  ACCEPT  ]  -> "Approve BOR-0026 for Rp 250.000.000?" [Confirm Approve] [Cancel] |
|  [  REJECT  ]  -> [ Remarks (required, min. 10 chars) ]  [Confirm Reject]  [Cancel] |
+-----------------------------------------------------------------------------------+
```

---

## 4. Location Filtering & Dataset Mapping

The dashboard must populate location dropdowns directly from the lending dataset (`province` and `city` columns of the master sheet):

### Supported Location Taxonomy
* **Jawa Timur:** Surabaya, Malang, Sidoarjo, Kediri, Jember.
* **Sulawesi Utara:** Manado, Bitung, Minahasa, Tomohon.
* **Sumatra Utara:** Medan, Deli Serdang, Pematangsiantar.
* **Sumatra Barat:** Padang, Bukittinggi.
* **Sulawesi Selatan:** Makassar.
* **Sulawesi Tengah:** Palu.

### Filter Behavior Rules
1. Province and City are **multi-select**; an empty selection means "All".
2. Selecting Provinces immediately narrows the **City** options to cities belonging to the selected provinces; selected cities outside them are dropped.
3. Selecting `All Provinces` resets the City options to `All Cities`.
4. Table re-rendering upon filter selection must execute in $< 300\text{ ms}$.

---

## 5. Data Schema & State Contracts

One Google Sheet with three tabs. Raven accesses it with a **service account** (Editor on the sheet); credentials are supplied via environment variable.

### 5.1 Master Tab `applications` (written by the n8n workflow)
Columns written by the workflow:

| Column | Notes |
| --- | --- |
| `borrower_id` | Unique key (one loan per borrower in the MVP) |
| `nik` | Raw 16-digit NIK — masked by Raven, never sent to the browser |
| `borrower_name` | Raw name — masked by Raven, never sent to the browser |
| `business_name`, `business_type` | |
| `province`, `city` | `city` added in v2.1 for the City filter |
| `tenor_months`, `monthly_income_idr`, `loan_amount_granted` | Never changed by Raven |
| `application_status` | `BORDERLINE_HITL` / `APPROVED_AUTO` / `DECLINED_AUTO` — never changed by Raven |
| `pd_score` | Decimal (0.10 = 10%) |
| `decision_notes` | AI-agent note explaining the borderline categorisation |

Columns written **only** by Raven (mirror of the review log):

| Column | Value |
| --- | --- |
| `borderline_final_review_status` | `APPROVED_HITL` or `DECLINED_HITL` |
| `reviewed_by` | Analyst email (from the signed-in session) |
| `reviewed_at` | ISO-8601 UTC timestamp |
| `review_remarks` | Analyst remarks |
| `review_id` | Links to the `raven_reviews` record |

### 5.2 Review Log Tab `raven_reviews` (Raven-owned, append-only)
Source of truth for review state and the audit trail. One row per decision:

```json
{
  "review_id": "5f0c…-uuid",
  "borrower_id": "BOR-0026",
  "action": "ACCEPT",
  "final_status": "APPROVED_HITL",
  "remarks": "Verified 6-month bank statements and off-take agreements.",
  "analyst_email": "analyst@company.co.id",
  "decided_at": "2026-10-09T23:25:00Z",
  "pd_score": 0.10,
  "loan_amount_granted": 250000000,
  "tenor_months": 12
}
```
`pd_score`, `loan_amount_granted` and `tenor_months` are a snapshot at decision time.

### 5.3 Users Tab `raven_users`
| Column | Values |
| --- | --- |
| `email` | Google account email (case-insensitive) |
| `display_name` | |
| `role` | `analyst` or `viewer` |
| `active` | `TRUE` / `FALSE` (deactivation takes effect within 5 minutes) |

### 5.4 Analyst Decision Request (`POST /api/decisions`)
```json
{ "borrower_id": "BOR-0026", "action": "ACCEPT", "remarks": "Optional for ACCEPT" }
```
The analyst identity and timestamp are set by the server, never taken from the request.

### 5.5 State Rules & Write Sequence
- **Pending:** `application_status == 'BORDERLINE_HITL'`, no `raven_reviews` row and empty `borderline_final_review_status`.
- **Accepted:** `APPROVED_AUTO` or final status `APPROVED_HITL`. **Rejected:** `DECLINED_AUTO` or `DECLINED_HITL`.
- **Write sequence:** (1) re-read; if already decided → HTTP 409 naming who decided and when; (2) append to `raven_reviews` (commit point); (3) update the master row's Raven columns. If (3) fails, the decision stands, the row is flagged "Sync pending" in History and an analyst can run **Re-sync**.
- Rows Raven cannot read and duplicate `borrower_id` rows are hidden from the portal. They are not shown in the UI; they are written to the server logs and reported by `npm run check:sheets`.

---

## 6. Business Logic & Validation Engine

1. **Remarks Rule:**
   - **Reject:** submission MUST fail client- and server-side with an inline error if `remarks.trim().length < 10`.
   - Error Message: *"Remarks are required to reject (minimum 10 characters)."*
   - **Accept:** remarks optional. Maximum length for any remarks: 1000 characters.

2. **Status Transition Matrix** (written to `borderline_final_review_status`):
   - Action `ACCEPT` $\rightarrow$ `APPROVED_HITL`
   - Action `REJECT` $\rightarrow$ `DECLINED_HITL`

3. **Restructuring Visual Indicator:** removed in v2.1 — the master sheet has a single `tenor_months` column, so requested vs. effective tenor cannot be compared.

---

## 7. User Stories & Acceptance Criteria (Gherkin Syntax)

### Story 1: Filter Pending Borderline Applications by Province/City
**As a** Regional Credit Risk Analyst,  
**I want to** filter the incoming application table by Province and City,  
**So that** I can focus exclusively on applications within my assigned geographical territory.

```gherkin
Scenario: Filtering applications by East Java province
  Given I am on "Tab 1: Incoming Applications"
  When I select "Jawa Timur" from the Province filter
  Then the table shall update within 300ms to show only records where province == "Jawa Timur"
  And the active row counter shall display "Showing X Pending Applications for Jawa Timur".

Scenario: Filtering by several provinces and a city
  Given I selected "Jawa Timur" and "Sulawesi Tengah" in the Province filter
  Then the City filter shall offer only cities in those provinces
  When I select "Palu" in the City filter
  Then the table shall show only records where city == "Palu".

Scenario: Resetting location filters
  Given the Province filter is set to "Jawa Timur"
  When I click the "Reset Filters" button
  Then the Province filter shall revert to "All Provinces"
  And the table shall display all pending borderline records ($5.0% \le PD \le 20.0%$).
```

### Story 2: Submit Review Decision
**As a** Credit Risk Analyst,  
**I want to** accept an application in one click or reject it with mandatory rationale remarks,  
**So that** the decision is permanently recorded in the audit trail and the record moves to the historical view.

```gherkin
Scenario: Successfully accepting an application
  Given I have selected application "BOR-0026" in the Incoming Table
  When I click "Accept"
  And I click "Confirm Approve"
  Then the system shall append an APPROVED_HITL record to "raven_reviews"
  And set borderline_final_review_status to "APPROVED_HITL" on the master sheet row
  And the application "BOR-0026" shall be removed from "Tab 1: Incoming Applications"
  And "BOR-0026" shall appear under "Tab 2: Historical Applications -> Accepted".

Scenario: Attempting a rejection without required remarks
  Given I have clicked "Reject" for application "BOR-0014"
  And the Remarks field is empty
  When I click "Confirm Reject"
  Then the system shall block submission
  And an error banner shall display "Remarks are required to reject (minimum 10 characters)."
  And no database write-back shall occur.

Scenario: Application already decided by another analyst
  Given "BOR-0026" was decided by another analyst after I opened it
  When I submit my decision
  Then the system shall reject it with "already decided by <email> at <time>"
  And no second review record shall be written.
```

### Story 3: Inspect View-Only Historical Applications
**As a** Credit Operations Manager or Auditor,  
**I want to** browse historical accepted and rejected loans in categorized sub-tabs,  
**So that** I can inspect past decision rationale without risking accidental edits.

```gherkin
Scenario: Viewing historical rejected applications
  Given I navigate to "Tab 2: Historical Applications"
  When I click the "Rejected Applications" sub-tab
  Then the table shall display all records with status "DECLINED_AUTO" or "DECLINED_HITL"
  And each row shall render Borrower ID, Name, Sector, Location, Decision Date, Decision Source, and Analyst Remarks
  And the interface shall contain no editable inputs or action buttons.
```

### Story 4: Restricted Access
**As a** Credit Risk Manager,  
**I want** only pre-registered staff to access Raven,  
**So that** borrower data and decisions are protected.

```gherkin
Scenario: Unregistered or deactivated account
  Given my Google account is not active in "raven_users"
  When I sign in
  Then access shall be denied with "This account is not registered for Raven, or it has been deactivated."

Scenario: Viewer cannot decide
  Given I am signed in with the "viewer" role
  When I open an application
  Then no Accept or Reject actions shall be shown
  And the decision API shall respond 403.
```

---

## 8. Non-Functional Requirements (NFRs) & UI Styling

### Theme & Palette Constants (Light Mode)
- **Canvas Background:** `#F8FAFC` (Slate 50)
- **Container Cards:** `#FFFFFF`
- **Border Strokes:** `#E2E8F0` (Slate 200); input and button outlines `#8391A4`
- **Primary Text:** `#0F172A` (Slate 900)
- **Muted Text:** `#64748B` (Slate 500)
- **Accent Coral (n8n Brand):** `#FF6D5A` for fills and tab underlines; `#C2402B` for coral text (readable on white)
- **Focus Outline:** `#334155` (Slate 700), neutral so a focused field never looks like an error
- **Status Indicators:** filled pills with white text and no border:
  - `APPROVED` / `ACCEPT`: `#047857` (Emerald 700)
  - `PENDING` / `BORDERLINE`: `#B45309` (Amber 700)
  - `DECLINED` / `REJECT`: `#DC2626` (Red 600)
- All text meets WCAG AA contrast (4.5:1); input outlines meet 3:1.

### Typography
- **Typeface:** Inter — used for all text in the app, including IDs and figures
- **Category:** Sans Serif
- **Colophon:** Rasmus Andersson (SIL Open Font License 1.1)
- Self-hosted at build time (no runtime requests to Google Fonts); fallbacks: system-ui, Segoe UI, Roboto, sans-serif.
- Numbers in tables (IDs, amounts, PD) use tabular figures so columns stay aligned.

### Interaction & Motion
- **Review drawer:** slides in from the right when "Review"/"View" is clicked and slides out when closed or after a decision (~200 ms).
- **Decision notifications:** a snackbar floats at the bottom centre over the page (it never pushes the list down) and dismisses itself after **5 seconds**; hovering or focusing it pauses the countdown, and it can be closed manually.
- Animations are disabled when the user's system requests reduced motion.

### Performance & Security
- **Render Latency:** Filtering or tab switching must complete in $< 300\text{ ms}$.
- **PII Security:** Full 16-digit NIK and full borrower names are masked on the server (`3578****0020`, `A*** G***`) and never sent to the browser.
- **Authentication:** Every page and API requires an active session; decisions require the `analyst` role; sessions expire after 8 hours.
- **Secrets:** Service-account key, OAuth client secret and session secret are supplied via environment variables, never committed.
- **Write safety:** Values are written to the sheet as raw text (no formula evaluation); cross-origin decision requests are rejected.
