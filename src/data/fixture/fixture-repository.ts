import type { RavenUser, ReviewRecord, SheetApplication } from "@/domain/types";
import sampleApplications from "../../../fixtures/applications.sample.json";
import sampleUsers from "../../../fixtures/users.sample.json";
import type { ApplicationReader, ApplicationsSnapshot, ReviewStore, UserDirectory } from "../ports";

/**
 * In-memory adapter over the bundled, fictional sample data, for local development and tests.
 * Decisions are kept in memory and reset when the process restarts.
 */
export class FixtureRepository implements ApplicationReader, ReviewStore, UserDirectory {
  private readonly applications: SheetApplication[];
  private readonly reviews: ReviewRecord[] = [];
  private readonly users: RavenUser[];

  constructor(
    applications: SheetApplication[] = sampleApplications as SheetApplication[],
    users: RavenUser[] = sampleUsers as RavenUser[],
  ) {
    this.applications = applications.map((app) => ({ ...app }));
    this.users = users.map((user) => ({ ...user, email: user.email.toLowerCase() }));
  }

  async listApplications(): Promise<ApplicationsSnapshot> {
    return { applications: this.applications.map((app) => ({ ...app })), errors: [] };
  }

  async listReviews(): Promise<ReviewRecord[]> {
    return this.reviews.map((review) => ({ ...review }));
  }

  async appendReview(review: ReviewRecord): Promise<void> {
    this.reviews.push({ ...review });
  }

  async markApplicationReviewed(review: ReviewRecord): Promise<void> {
    const app = this.applications.find((row) => row.borrower_id === review.borrower_id);
    if (!app) throw new Error(`No application row for ${review.borrower_id}.`);
    Object.assign(app, {
      borderline_final_review_status: review.final_status,
      reviewed_by: review.analyst_email,
      reviewed_at: review.decided_at,
      review_remarks: review.remarks,
      review_id: review.review_id,
    });
  }

  async listUsers(): Promise<RavenUser[]> {
    return this.users.map((user) => ({ ...user }));
  }

  async findUser(email: string): Promise<RavenUser | null> {
    const target = email.trim().toLowerCase();
    return this.users.find((user) => user.email === target) ?? null;
  }
}
