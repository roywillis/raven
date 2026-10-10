import { NextResponse } from "next/server";

/**
 * Matches errors by `name` rather than `instanceof`: the shared service singleton may have been
 * created by another bundle layer (page vs route handler), whose error classes are distinct
 * copies, so `instanceof` would miss them.
 */
function named(error: unknown, ...names: string[]): error is Error & { status?: number } {
  return error instanceof Error && names.includes(error.name);
}

/** Maps known errors to JSON responses; unknown errors become a generic 500. */
export function errorResponse(error: unknown): NextResponse {
  if (named(error, "AuthError", "DecisionError") && typeof error.status === "number") {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (named(error, "SheetSchemaError")) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  if (named(error, "SheetsApiError")) {
    console.error("[raven]", error);
    return NextResponse.json({ error: "Google Sheets is unavailable. Please retry shortly." }, { status: 502 });
  }
  if (named(error, "ConfigError")) {
    console.error("[raven]", error);
    return NextResponse.json({ error: "Server is misconfigured." }, { status: 500 });
  }
  console.error("[raven] unexpected error:", error);
  return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
}
