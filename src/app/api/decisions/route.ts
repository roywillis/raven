import { NextResponse } from "next/server";

/**
 * POST /api/decisions: PLACEHOLDER for the analyst decision write-back (prd.md §2.3, §5.2).
 * Remarks validation, the status transition and the call to `DecisionWriter` are not built yet.
 */
export async function POST() {
  return NextResponse.json({ error: "Decision write-back is not implemented yet." }, { status: 501 });
}
