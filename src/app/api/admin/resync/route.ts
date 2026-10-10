import { NextResponse } from "next/server";
import { errorResponse } from "@/auth/http";
import { assertSameOrigin, requireUser } from "@/auth/session";
import { getReviewService } from "@/services/review-service";

/** POST /api/admin/resync: re-applies logged decisions missing from the master sheet. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireUser("analyst");
    return NextResponse.json(await getReviewService().resync());
  } catch (error) {
    return errorResponse(error);
  }
}
