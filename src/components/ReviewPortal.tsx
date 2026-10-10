"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ApplicationView, QueueView, UserRole } from "@/domain/types";
import { HistoryTab } from "./HistoryTab";
import { IncomingTab } from "./IncomingTab";
import { ReviewDrawer } from "./ReviewDrawer";

interface ReviewPortalProps {
  queue: QueueView;
  user: { email: string; name: string; role: UserRole };
}

type Notice = { message: string; tone: "success" | "warning" | "error" };

export function ReviewPortal({ queue, user }: ReviewPortalProps) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [tab, setTab] = useState<"incoming" | "history">("incoming");
  const [selected, setSelected] = useState<ApplicationView | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const canDecide = user.role === "analyst";
  const syncPending = [...queue.accepted, ...queue.rejected].filter((row) => row.sync_pending).length;

  const refresh = () => startRefresh(() => router.refresh());

  async function resync() {
    const response = await fetch("/api/admin/resync", { method: "POST" });
    const body = (await response.json().catch(() => ({}))) as { resynced?: string[]; failed?: unknown[]; error?: string };
    setNotice(
      response.ok
        ? { message: `Re-synced ${body.resynced?.length ?? 0}; failed ${body.failed?.length ?? 0}.`, tone: body.failed?.length ? "warning" : "success" }
        : { message: body.error ?? "Re-sync failed.", tone: "error" },
    );
    refresh();
  }

  return (
    <div className="portal">
      <header className="topbar">
        <div className="brand">
          RAVEN <span className="muted">Reviewer Portal</span>
        </div>
        <div className="user">
          <span>
            {user.name} <span className="muted small">({user.role})</span>
          </span>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => signOut({ callbackUrl: "/signin" })}>
            Sign out
          </button>
        </div>
      </header>

      <main className="content">
        {notice && (
          <div className={`banner banner-${notice.tone}`} role="status">
            <span>{notice.message}</span>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setNotice(null)} aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}
        {queue.data_errors.length > 0 && (
          <details className="banner banner-warning">
            <summary>{queue.data_errors.length} data issue(s) in the sheet need attention</summary>
            <ul>
              {queue.data_errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </details>
        )}
        {canDecide && syncPending > 0 && (
          <div className="banner banner-warning">
            <span>{syncPending} decision(s) are not yet mirrored to the master sheet.</span>
            <button type="button" className="btn btn-small" onClick={resync}>
              Re-sync now
            </button>
          </div>
        )}

        <nav className="tabs" role="tablist" aria-label="Application views">
          <button type="button" role="tab" aria-selected={tab === "incoming"} onClick={() => setTab("incoming")}>
            Incoming Applications ({queue.pending.length})
          </button>
          <button type="button" role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")}>
            Historical Applications
          </button>
          <button type="button" className="btn btn-ghost btn-small refresh" onClick={refresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </nav>

        {tab === "incoming" ? (
          <IncomingTab rows={queue.pending} canDecide={canDecide} onReview={setSelected} />
        ) : (
          <HistoryTab accepted={queue.accepted} rejected={queue.rejected} />
        )}
      </main>

      {selected && (
        <ReviewDrawer
          key={selected.borrower_id}
          application={selected}
          canDecide={canDecide}
          onClose={() => setSelected(null)}
          onDecided={(message, tone) => {
            setSelected(null);
            setNotice({ message, tone });
            refresh();
          }}
        />
      )}
    </div>
  );
}
