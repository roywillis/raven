/**
 * PII masking (prd.md §8). Applied on the server before any data reaches the browser.
 */

/** `3578012345670020` → `3578****0020`. Too-short or empty values are fully masked. */
export function maskNik(nik: string): string {
  const digits = nik.replace(/\D/g, "");
  if (digits.length < 8) return digits.length === 0 ? "" : "****";
  return `${digits.slice(0, 4)}****${digits.slice(-4)}`;
}

/** `Anton Gunawan` → `A*** G***`. */
export function maskName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word[0].toUpperCase()}***`)
    .join(" ");
}
