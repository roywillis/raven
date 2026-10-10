import { beforeEach, describe, expect, it, vi } from "vitest";
import { FixtureRepository } from "@/data/fixture/fixture-repository";
import { ReviewService } from "@/services/review-service";
import { makeApp } from "./helpers";

const session = vi.hoisted(() => ({ user: null as null | { email: string; name: string; role: "analyst" | "viewer" } }));
let service: ReviewService;

vi.mock("@/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/auth/session")>();
  return {
    ...actual,
    getSessionUser: async () => session.user,
    requireUser: async (role?: "analyst" | "viewer") => {
      if (!session.user) throw new actual.AuthError(401, "Sign in required.");
      if (role && session.user.role !== role) throw new actual.AuthError(403, `This action requires the ${role} role.`);
      return session.user;
    },
  };
});
vi.mock("@/services/review-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/review-service")>();
  return { ...actual, getReviewService: () => service };
});

const { POST: postDecision } = await import("@/app/api/decisions/route");
const { GET: getApplications } = await import("@/app/api/applications/route");

function decisionRequest(body: unknown, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/decisions", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3000", origin },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  const store = new FixtureRepository([makeApp()], []);
  service = new ReviewService({ applications: store, reviews: store, users: store }, { onSyncError: () => undefined });
  session.user = { email: "analyst@raven.local", name: "Ana", role: "analyst" };
});

describe("POST /api/decisions", () => {
  it("returns 401 without a session and 403 for viewers", async () => {
    session.user = null;
    expect((await postDecision(decisionRequest({ borrower_id: "BOR-0026", action: "ACCEPT" }))).status).toBe(401);
    session.user = { email: "v@x.id", name: "V", role: "viewer" };
    expect((await postDecision(decisionRequest({ borrower_id: "BOR-0026", action: "ACCEPT" }))).status).toBe(403);
  });

  it("rejects cross-origin requests", async () => {
    const response = await postDecision(decisionRequest({ borrower_id: "BOR-0026", action: "ACCEPT" }, "https://evil.example"));
    expect(response.status).toBe(403);
  });

  it("returns 400 for invalid JSON or a reject without remarks", async () => {
    expect((await postDecision(decisionRequest("{oops"))).status).toBe(400);
    const response = await postDecision(decisionRequest({ borrower_id: "BOR-0026", action: "REJECT" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Remarks are required to reject (minimum 10 characters)." });
  });

  it("records the signed-in analyst, ignoring any analyst field in the body", async () => {
    const response = await postDecision(
      decisionRequest({ borrower_id: "BOR-0026", action: "ACCEPT", analyst_email: "someone-else@x.id" }),
    );
    expect(response.status).toBe(201);
    expect((await response.json()).review.analyst_email).toBe("analyst@raven.local");
    expect((await postDecision(decisionRequest({ borrower_id: "BOR-0026", action: "ACCEPT" }))).status).toBe(409);
  });
});

describe("GET /api/applications", () => {
  it("requires a session and never returns raw PII", async () => {
    session.user = null;
    expect((await getApplications()).status).toBe(401);
    session.user = { email: "v@x.id", name: "V", role: "viewer" };
    const response = await getApplications();
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(JSON.parse(text).pending[0].masked_nik).toBe("3578****0020");
    expect(text).not.toContain("3578010101900020");
    expect(text).not.toContain("Anton Gunawan");
  });
});
