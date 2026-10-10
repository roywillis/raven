import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { ReviewPortal } from "@/components/ReviewPortal";
import type { QueueView } from "@/domain/types";
import { getReviewService } from "@/services/review-service";

export const dynamic = "force-dynamic";

async function loadQueue(): Promise<{ queue: QueueView } | { error: string }> {
  try {
    return { queue: await getReviewService().getQueue() };
  } catch (error) {
    console.error("[raven] failed to load applications:", error);
    return {
      error:
        error instanceof Error && error.name === "SheetSchemaError"
          ? error.message
          : "The data source is unavailable. Please retry shortly.",
    };
  }
}

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const result = await loadQueue();
  if ("queue" in result) return <ReviewPortal queue={result.queue} user={user} />;

  return (
    <main className="signin">
      <div className="card signin-card">
        <h1>Applications could not be loaded</h1>
        <p className="banner banner-error" role="alert">
          {result.error}
        </p>
        <Link className="btn" href="/">
          Retry
        </Link>
      </div>
    </main>
  );
}
