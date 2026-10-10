/**
 * PLACEHOLDER shell. Tabs, filter bar, tables and the review drawer (prd.md §3) are not built yet.
 */
export default function HomePage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Raven Reviewer Portal</h1>
      <nav aria-label="Application views" style={{ display: "flex", gap: 16 }}>
        <span>Tab 1: Incoming Applications</span>
        <span style={{ color: "var(--color-text-muted)" }}>Tab 2: Historical Applications</span>
      </nav>
      <p style={{ color: "var(--color-text-muted)" }}>Scaffold only: views are not implemented yet.</p>
    </main>
  );
}
