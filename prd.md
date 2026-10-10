# Product Requirement Document (PRD) — Project "Raven"
**Product Name:** Credit Risk Analyst Reviewer Portal (Raven)  
**Document Version:** 2.0 (Refined Development Scope)  
**Target Consumer:** Claude Code / Engineering Team  
**Status:** Approved for Implementation  

---

## 1. Executive Summary & Architecture Context

Project **Raven** is a Human-in-the-Loop (HITL) Credit Risk Reviewer Dashboard engineered for Regional Credit Risk Analysts. It serves as the manual review gateway in an automated MSME credit underwriting pipeline (n8n Workflow Orchestrator + Python Micro-Services).

The dashboard intercepts borderline loan applications—specifically those evaluated with a Probability of Default ($PD$) between $5.0\%$ and $20.0\%$—and provides analysts with a clean, table-based interface to filter incoming requests by location (Province/City), inspect borrower risk profiles, and execute **Accept** or **Reject** decisions accompanied by mandatory decision **Remarks**. Completed decisions are automatically written back to the master database and migrated to a view-only historical log.

---

## 2. Core Functional Scope

### In-Scope (P0 MVP Deliverables)
1. **Tab 1: Incoming Applications (Pending Borderline Review)**
   - Table view displaying pending records where `application_status == 'BORDERLINE_HITL'` ($5.0\% \le PD \le 20.0\%$).
   - Location Filter Bar supporting cascading **Province** and **City/Municipality** filtering based on dataset values.
   - Interactive Application Review Drawer / Modal showing borrower financial profile, credit score, calculated $PD\%$, auto-restructured terms (e.g., Culinary 24m $\rightarrow$ 12m tenor capping), and risk drivers.
   - Action Panel with **Accept** and **Reject** buttons + mandatory **Remarks** text input.

2. **Tab 2: Historical Applications (View-Only Log)**
   - Categorized sub-tabs for **Accepted Applications** (`APPROVED_AUTO`, `APPROVED_HITL`) and **Rejected Applications** (`DECLINED_AUTO`, `DECLINED_HITL`).
   - Read-only table view featuring borrower metadata, decision timestamp, analyst ID, decision source (STP vs HITL), and analyst remarks.

3. **Database Sync & State Management**
   - Asynchronous write-back upon decision submission updating `application_status`, `loan_amount_granted`, `effective_tenor_months`, `analyst_remarks`, and `processed_at_timestamp`.
   - Automatic row transition from `Incoming` to `Historical` view upon successful write-back.

### Out-of-Scope (Explicit Non-Goals)
- Real-time API integration with central bank credit bureaus (SLIK/Pefindo).
- Automated OCR scanning of paper cash diaries.
- Automated debt collection or post-disbursement borrower chat messaging.

---

## 3. UI Layout & Component Architecture

```
+-----------------------------------------------------------------------------------+
|  RAVEN REVIEWER PORTAL (Dark Slate Mode: #0F172A)                                 |
|                                                                                   |
|  [ TAB 1: INCOMING APPLICATIONS (3) ]   |   [ TAB 2: HISTORICAL APPLICATIONS ]    |
|  ==============================================================================   |
|                                                                                   |
|  FILTER BAR:                                                                      |
|  [ Province: Jawa Timur v ]  [ City: Surabaya v ]  [ Search Borrower ID/Name:  ]  |
|  -------------------------------------------------------------------------------  |
|                                                                                   |
|  INCOMING APPLICATIONS TABLE                                                      |
|  | ID       | Borrower / Business | Sector     | Province   | PD (%) | Actions   |
|  |----------|---------------------|------------|------------|--------|-----------|
|  | BOR-0026 | A*** G*** (Sayur)   | Pertanian  | Jawa Timur | 10.00% | [Review]  |
|  | BOR-0010 | M*** H*** (Dapur)   | Kuliner    | Jawa Timur | 14.50% | [Review]  |
|  | BOR-0014 | R*** S*** (Toko)    | Perdagangan| Sulawesi U.| 18.20% | [Review]  |
|                                                                                   |
+-----------------------------------------------------------------------------------+
|  REVIEW & ACTION DRAWER (When row is selected)                                   |
|  -------------------------------------------------------------------------------  |
|  Applicant: BOR-0026 | NIK: 3578****0020 | Credit Score: 670 | DTI: 23.61%           |
|  Requested: Rp 250,000,000 (24m) --> Effective Restructured: Rp 250,000,000 (12m)   |
|  AI Risk Note: Moderate risk, comfortable DTI. Requires off-take verification.   |
|                                                                                   |
|  ANALYST DECISION:                                                                |
|  [ Remarks (Mandatory): "Verified 6m bank statements and farm inventory."       ] |
|  [  ACCEPT  ]   [  REJECT  ]                                                      |
+-----------------------------------------------------------------------------------+
```

---

## 4. Location Filtering & Dataset Mapping

The dashboard must populate location dropdowns directly from the lending dataset (`Province` and `City/Kabupaten` fields):

### Supported Location Taxonomy
* **Jawa Timur:** Surabaya, Malang, Sidoarjo, Kediri, Jember.
* **Sulawesi Utara:** Manado, Bitung, Minahasa, Tomohon.
* **Sumatra Utara:** Medan, Deli Serdang, Pematangsiantar.
* **Sumatra Barat:** Padang, Bukittinggi.
* **South / Central Sulawesi:** Makassar, Palu.

### Filter Behavior Rules
1. Selecting a **Province** immediately narrows the **City** dropdown to cities belonging to that province.
2. Selecting `All Provinces` resets the City dropdown to `All Cities`.
3. Table re-rendering upon filter selection must execute in $< 300\text{ ms}$.

---

## 5. Data Schema & State Contracts

### 5.1 Ingested Application Payload Schema (`Incoming`)
```json
{
  "borrower_id": "BOR-0026",
  "masked_nik": "3578****0020",
  "masked_name": "A*** G***",
  "business_name": "Distributor Sayur Anton",
  "business_type": "Pertanian",
  "province": "Jawa Timur",
  "city": "Surabaya",
  "credit_score": 670,
  "monthly_income_idr": 90000000,
  "monthly_installment_idr": 21250000,
  "dti_ratio": 0.2361,
  "requested_amount_idr": 250000000,
  "requested_tenor_months": 24,
  "effective_amount_idr": 250000000,
  "effective_tenor_months": 12,
  "pd_score": 0.1000,
  "pd_label": "10.00%",
  "application_status": "BORDERLINE_HITL",
  "risk_summary": "Moderate risk profile. Tenor auto-capped to 12 months to lower default risk from 35% to 12.9%."
}
```

### 5.2 Analyst Decision Action Payload (`Write-Back`)
```json
{
  "borrower_id": "BOR-0026",
  "analyst_id": "ANALYST_SURABAYA_01",
  "action": "ACCEPT", // "ACCEPT" | "REJECT"
  "updated_status": "APPROVED_HITL", // "APPROVED_HITL" or "DECLINED_HITL"
  "remarks": "Verified 6-month bank statements and off-take agreements. Business cash flow confirmed.",
  "timestamp": "2026-10-09T23:25:00Z"
}
```

---

## 6. Business Logic & Validation Engine

1. **Mandatory Remarks Rule:**
   - The `Confirm Submit` trigger MUST fail client-side and display an inline error if `remarks.trim().length < 10`.
   - Error Message: *"Remarks are required (minimum 10 characters) to explain decision rationale."*

2. **Status Transition Matrix:**
   - Action `ACCEPT` $\rightarrow$ `application_status = 'APPROVED_HITL'`
   - Action `REJECT` $\rightarrow$ `application_status = 'DECLINED_HITL'`

3. **Restructuring Visual Indicator:**
   - If `requested_tenor_months != effective_tenor_months`, display an Amber Badge: `RESTRUCTURED: Tenor Capped from 24m to 12m`.

---

## 7. User Stories & Acceptance Criteria (Gherkin Syntax)

### Story 1: Filter Pending Borderline Applications by Province/City
**As a** Regional Credit Risk Analyst,  
**I want to** filter the incoming application table by Province and City,  
**So that** I can focus exclusively on applications within my assigned geographical territory.

```gherkin
Scenario: Filtering applications by East Java province
  Given I am on "Tab 1: Incoming Applications"
  When I select "Jawa Timur" from the Province dropdown filter
  Then the table shall update within 300ms to show only records where province == "Jawa Timur"
  And the active row counter shall display "Showing X Pending Applications for Jawa Timur".

Scenario: Resetting location filters
  Given the Province filter is set to "Jawa Timur"
  When I click the "Reset Filters" button
  Then the Province dropdown shall revert to "All Provinces"
  And the table shall display all pending borderline records ($5.0% \le PD \le 20.0%$).
```

### Story 2: Submit Review Decision with Mandatory Remarks
**As a** Credit Risk Analyst,  
**I want to** execute an Accept or Reject action with mandatory rationale remarks,  
**So that** the decision is permanently recorded in the audit trail and the record moves to the historical view.

```gherkin
Scenario: Successfully accepting an application with remarks
  Given I have selected application "BOR-0026" in the Incoming Table
  When I click "Accept"
  And I enter remarks "Verified bank statement and site visit completed."
  And I click "Submit Decision"
  Then the system shall update application_status to "APPROVED_HITL" in the master sheet
  And the application "BOR-0026" shall be removed from "Tab 1: Incoming Applications"
  And "BOR-0026" shall appear under "Tab 2: Historical Applications -> Accepted".

Scenario: Attempting submission without required remarks
  Given I have clicked "Reject" for application "BOR-0014"
  And the Remarks field is empty
  When I click "Submit Decision"
  Then the system shall block submission
  And an error banner shall display "Remarks are required (minimum 10 characters)."
  And no database write-back shall occur.
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

---

## 8. Non-Functional Requirements (NFRs) & UI Styling

### Theme & Palette Constants (Dark Slate Mode)
- **Canvas Background:** `#0F172A` (Slate 900)
- **Container Cards:** `#1E293B` (Slate 800)
- **Border Strokes:** `#334155` (Slate 700)
- **Primary Text:** `#F8FAFC` (Slate 50)
- **Muted Text:** `#94A3B8` (Slate 400)
- **Accent Coral (n8n Brand):** `#FF6D5A`
- **Status Indicators:**
  - `APPROVED` / `ACCEPT`: `#10B981` (Emerald 500)
  - `PENDING` / `BORDERLINE`: `#F59E0B` (Amber 500)
  - `DECLINED` / `REJECT`: `#EF4444` (Red 500)

### Performance & Security
- **Render Latency:** Filtering or tab switching must complete in $< 300\text{ ms}$.
- **PII Security:** Full 16-digit NIK and full borrower names must be masked on table views (`3578****0020`, `A*** G***`).
