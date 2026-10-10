import { NextResponse, type NextRequest } from "next/server";
import { createRepositories, NotImplementedError, type HistoricalCategory } from "@/data";

export const dynamic = "force-dynamic";

const VIEWS = ["incoming", "accepted", "rejected"] as const;
type View = (typeof VIEWS)[number];

/** GET /api/applications?view=incoming|accepted|rejected (default: incoming). */
export async function GET(request: NextRequest) {
  const view = (request.nextUrl.searchParams.get("view") ?? "incoming") as View;
  if (!VIEWS.includes(view)) {
    return NextResponse.json({ error: `view must be one of: ${VIEWS.join(", ")}` }, { status: 400 });
  }

  try {
    const { reader } = createRepositories();
    const applications =
      view === "incoming"
        ? await reader.listIncoming()
        : await reader.listHistorical(view as HistoricalCategory);
    return NextResponse.json({ view, applications });
  } catch (error) {
    if (error instanceof NotImplementedError) {
      return NextResponse.json({ error: error.message }, { status: 501 });
    }
    throw error;
  }
}
