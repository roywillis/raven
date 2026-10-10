import { NextResponse } from "next/server";
import { errorResponse } from "@/auth/http";
import { assertSameOrigin, requireUser } from "@/auth/session";
import { DecisionError, getReviewService } from "@/services/review-service";

/**
 * POST /api/decisions  { borrower_id, action: "ACCEPT" | "REJECT", remarks? }
 * Analyst role only. The analyst recorded is the signed-in user, never a value from the body.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser("analyst");
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new DecisionError(400, "Request body must be valid JSON.");
    }
    const result = await getReviewService().submitDecision(body, user.email);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
