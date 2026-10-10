import { NextResponse } from "next/server";
import { errorResponse } from "@/auth/http";
import { requireUser } from "@/auth/session";
import { getReviewService } from "@/services/review-service";

export const dynamic = "force-dynamic";

/** GET /api/applications: pending queue plus accepted/rejected history (PII masked). */
export async function GET() {
  try {
    await requireUser();
    return NextResponse.json(await getReviewService().getQueue());
  } catch (error) {
    return errorResponse(error);
  }
}
