"use client";

import { useEffect, useId, useRef, useState } from "react";

interface MultiSelectProps {
  label: string;
  allLabel: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

/** Dropdown of checkboxes. An empty selection means "all". */
export function MultiSelect({ label, allLabel, options, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const toggle = (option: string) =>
    onChange(selected.includes(option) ? selected.filter((value) => value !== option) : [...selected, option]);

  const summary =
    selected.length === 0 ? allLabel : selected.length <= 2 ? selected.join(", ") : `${selected.length} selected`;

  return (
    <div className="multiselect" ref={rootRef}>
      <span className="field-label">{label}</span>
      <button
        type="button"
        className="multiselect-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{summary}</span>
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="multiselect-menu" id={listId} role="listbox" aria-multiselectable>
          <button type="button" className="multiselect-all" onClick={() => onChange([])}>
            {allLabel}
          </button>
          {options.length === 0 && <p className="muted small">No options</p>}
          {options.map((option) => (
            <label key={option} className="multiselect-option">
              <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} />
              {option}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
