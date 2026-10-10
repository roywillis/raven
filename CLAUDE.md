# Claude Code Agent Instructions

You are acting as the primary software engineer executing tasks in this repository. Follow the standing instructions below for all work.

---

## 1. Context & Source of Truth

Always read and align with the core project documents before writing code:

1. **`README.md` (Project Foundations):**
   - Read `README.md` to understand repository setup, runtime dependencies, directory structure, and environment variables.
   - Run the exact build, lint, and test commands documented in `README.md`.

2. **`PRD.md` (Feature Specifications):**
   - Treat `PRD.md` as the authoritative source of truth for scope, functional requirements, and acceptance criteria.
   - Do NOT implement features or workflows marked as **Out of Scope** or **Non-Goals** in `PRD.md`.
   - Implement solutions that satisfy the Gherkin scenarios (`Given / When / Then`) defined in `PRD.md`.

---

## 2. Execution Workflow

When assigned a task, follow this phased approach:

### Phase 1: Exploration & Planning
- Inspect the codebase to identify files requiring changes or creation.
- Check existing utilities, shared types, and architectural patterns so new code matches the codebase style.
- Formulate a concise step-by-step implementation plan.
- If running in **Plan Mode**, present the plan and wait for user approval before making file changes.

### Phase 2: Implementation
- Implement changes incrementally in logical batches.
- Adhere strictly to existing coding standards, type systems, and naming conventions.
- Do NOT introduce unrequested dependencies, heavy libraries, or large architectural refactors unless explicitly stated in `PRD.md`.
- Keep modifications minimal and focused strictly on the assigned scope.

### Phase 3: Verification & Quality Gate
Before signaling task completion:
- Run the project's build and lint checks (as specified in `README.md`).
- Run the automated test suite.
- Write unit or integration tests for newly introduced logic and edge cases covered in `PRD.md`.
- Ensure all tests pass with zero warnings or runtime errors.

---

## 3. Error Handling & Edge Cases

- **Idempotency & Resilience:** Implement proper validation, error handling, and graceful recovery for failed operations or network boundaries.
- **Fail Fast:** Validate inputs at function and API boundaries before processing.
- **Diagnostics:** If a build or test fails during your session, diagnose the root cause, fix the issue, and re-run verification before reporting back.

---

## 4. Git & Pull Request Expectations

- Work exclusively on the assigned feature branch (never commit unapproved breaking changes directly to `main`).
- Keep diffs clean: do not reformat unrelated files or introduce arbitrary whitespace changes.
- In your final summary, provide:
  1. A concise overview of files added or modified.
  2. Proof of verification (commands run and test results).
  3. A checklist mapping implemented changes directly to the Acceptance Criteria in `PRD.md`.
