"use client";

import { useCallback, useEffect, useState } from "react";
import { REJECT_REMARKS_ERROR, REMARKS_MAX_LENGTH, REMARKS_MIN_LENGTH } from "@/domain/review";
import type { ApplicationView, DecisionAction } from "@/domain/types";
import { formatRupiah } from "./format";

interface ReviewDrawerProps {
  application: ApplicationView;
  canDecide: boolean;
  onClose: () => void;
  /** Called after the server accepted (or rejected as stale) a decision. */
  onDecided: (message: string, tone: "success" | "warning" | "error") => void;
}

type Mode = "view" | "confirm-accept" | "reject";

/** Matches the slide-out animation in globals.css. */
const CLOSE_ANIMATION_MS = 200;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function ReviewDrawer({ application: app, canDecide, onClose, onDecided }: ReviewDrawerProps) {
  const [mode, setMode] = useState<Mode>("view");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);

  /** Plays the slide-out animation, then runs `then` (which unmounts the drawer). */
  const animateOut = useCallback(
    (then: () => void) => {
      if (closing) return;
      setClosing(true);
      window.setTimeout(then, prefersReducedMotion() ? 0 : CLOSE_ANIMATION_MS);
    },
    [closing],
  );

  const close = useCallback(() => {
    if (!submitting) animateOut(onClose);
  }, [animateOut, onClose, submitting]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  async function submit(action: DecisionAction) {
    if (action === "REJECT" && remarks.trim().length < REMARKS_MIN_LENGTH) {
      setError(REJECT_REMARKS_ERROR);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ borrower_id: app.borrower_id, action, remarks: remarks.trim() }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; sync_pending?: boolean };
      if (response.status === 201) {
        const verb = action === "ACCEPT" ? "approved" : "rejected";
        const done = body.sync_pending
          ? `${app.borrower_id} ${verb}. The decision is saved; the master sheet will be updated on re-sync.`
          : `${app.borrower_id} ${verb}.`;
        animateOut(() => onDecided(done, body.sync_pending ? "warning" : "success"));
        return;
      }
      if (response.status === 409 || response.status === 404) {
        const message = body.error ?? "This application is no longer pending.";
        animateOut(() => onDecided(message, "error"));
        return;
      }
      setError(body.error ?? `Request failed (${response.status}).`);
    } catch {
      setError("Network error. Your decision was not submitted; please retry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={closing ? "drawer-backdrop is-closing" : "drawer-backdrop"}
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="drawer-header">
          <h2 id="drawer-title">
            {app.borrower_id} · {app.business_name}
          </h2>
          <button type="button" className="btn btn-ghost" onClick={close} disabled={submitting} aria-label="Close">
            ✕
          </button>
        </header>

        <dl className="profile-grid">
          <div><dt>Applicant</dt><dd>{app.masked_name}</dd></div>
          <div><dt>NIK</dt><dd>{app.masked_nik}</dd></div>
          <div><dt>Sector</dt><dd>{app.business_type}</dd></div>
          <div><dt>Location</dt><dd>{app.city}, {app.province}</dd></div>
          <div><dt>Credit score</dt><dd>{app.credit_score}</dd></div>
          <div><dt>PD</dt><dd><span className="badge badge-pending">{app.pd_label}</span></dd></div>
          <div><dt>Monthly income</dt><dd>{formatRupiah(app.monthly_income_idr)}</dd></div>
          <div><dt>Loan amount granted</dt><dd>{formatRupiah(app.loan_amount_granted)} ({app.tenor_months}m)</dd></div>
        </dl>

        <section className="ai-note">
          <h3>AI risk note</h3>
          <p>{app.decision_notes || "—"}</p>
        </section>

        {canDecide ? (
          <section className="decision" aria-label="Analyst decision">
            <h3>Analyst decision</h3>
            {mode === "view" && (
              <div className="decision-buttons">
                <button type="button" className="btn btn-accept" onClick={() => switchMode("confirm-accept")}>
                  Accept
                </button>
                <button type="button" className="btn btn-reject" onClick={() => switchMode("reject")}>
                  Reject
                </button>
              </div>
            )}

            {mode !== "view" && (
              <>
                <p>
                  {mode === "confirm-accept"
                    ? `Approve ${app.borrower_id} for ${formatRupiah(app.loan_amount_granted)}?`
                    : `Reject ${app.borrower_id}? Explain the rationale below.`}
                </p>
                <label className="field-label" htmlFor="remarks">
                  {mode === "reject" ? `Remarks (required, minimum ${REMARKS_MIN_LENGTH} characters)` : "Remarks (optional)"}
                </label>
                <textarea
                  id="remarks"
                  rows={3}
                  maxLength={REMARKS_MAX_LENGTH}
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "decision-error" : undefined}
                  autoFocus
                />
                {error && (
                  <p id="decision-error" className="banner banner-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="decision-buttons">
                  <button
                    type="button"
                    className={mode === "reject" ? "btn btn-reject" : "btn btn-accept"}
                    disabled={submitting}
                    onClick={() => submit(mode === "reject" ? "REJECT" : "ACCEPT")}
                  >
                    {submitting ? "Submitting…" : mode === "reject" ? "Confirm Reject" : "Confirm Approve"}
                  </button>
                  <button type="button" className="btn btn-ghost" disabled={submitting} onClick={() => switchMode("view")}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </section>
        ) : (
          <p className="muted small">View-only access: decisions can be made by analysts only.</p>
        )}
      </aside>
    </div>
  );
}
