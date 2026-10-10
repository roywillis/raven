"use client";

import { useCallback, useEffect, useRef } from "react";

export const TOAST_DURATION_MS = 5000;

export interface Notice {
  /** Unique per notice, so a new notice restarts the timer (used as the React key). */
  id: number;
  message: string;
  tone: "success" | "warning" | "error";
}

interface ToastProps {
  notice: Notice;
  onDismiss: () => void;
}

/**
 * Snackbar that floats over the page (it never pushes content down) and dismisses itself after
 * TOAST_DURATION_MS. Hovering or focusing it pauses the countdown so the message can be read.
 */
export function Toast({ notice, onDismiss }: ToastProps) {
  const onDismissRef = useRef(onDismiss);
  const timer = useRef<number | undefined>(undefined);
  const remaining = useRef(TOAST_DURATION_MS);
  const startedAt = useRef(0);
  const paused = useRef(false);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  const start = useCallback(() => {
    startedAt.current = Date.now();
    timer.current = window.setTimeout(() => onDismissRef.current(), remaining.current);
  }, []);

  const pause = useCallback(() => {
    if (paused.current) return;
    paused.current = true;
    window.clearTimeout(timer.current);
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
  }, []);

  const resume = useCallback(() => {
    if (!paused.current) return;
    paused.current = false;
    start();
  }, [start]);

  useEffect(() => {
    start();
    return () => window.clearTimeout(timer.current);
  }, [start]);

  return (
    <div
      className={`toast toast-${notice.tone}`}
      role={notice.tone === "error" ? "alert" : "status"}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <span className="toast-message">{notice.message}</span>
      <button type="button" className="toast-close" onClick={onDismiss} aria-label="Dismiss notification">
        ✕
      </button>
      <span className="toast-progress" style={{ animationDuration: `${TOAST_DURATION_MS}ms` }} aria-hidden />
    </div>
  );
}
