import { beforeEach, describe, expect, it, vi } from "vitest";
import { FixtureRepository } from "@/data/fixture/fixture-repository";
import type { Repositories } from "@/data/ports";
import { REJECT_REMARKS_ERROR } from "@/domain/review";
import { DecisionError, ReviewService } from "@/services/review-service";
import { makeApp } from "./helpers";

let store: FixtureRepository;
let repos: Repositories;
let service: ReviewService;
let ids = 0;

beforeEach(() => {
  store = new FixtureRepository(
    [makeApp(), makeApp({ borrower_id: "BOR-0014", province: "Sulawesi Utara", city: "Manado" })],
    [],
  );
  repos = { applications: store, reviews: store, users: store };
  ids = 0;
  service = new ReviewService(repos, {
    newId: () => `rev-${++ids}`,
    now: () => new Date("2026-10-09T23:25:00Z"),
    onSyncError: () => undefined,
  });
});

describe("Story 2: submit review decision", () => {
  it("accepting logs the decision, updates the master row and moves it to Historical → Accepted", async () => {
    const result = await service.submitDecision({ borrower_id: "BOR-0026", action: "ACCEPT" }, "analyst@raven.local");
    expect(result).toEqual({
      sync_pending: false,
      review: expect.objectContaining({ review_id: "rev-1", final_status: "APPROVED_HITL", analyst_email: "analyst@raven.local", decided_at: "2026-10-09T23:25:00.000Z" }),
    });

    const master = (await store.listApplications()).applications.find((app) => app.borrower_id === "BOR-0026");
    expect(master).toMatchObject({ borderline_final_review_status: "APPROVED_HITL", review_id: "rev-1", loan_amount_granted: 250000000 });

    const queue = await service.getQueue();
    expect(queue.pending.map((row) => row.borrower_id)).toEqual(["BOR-0014"]);
    expect(queue.accepted.map((row) => row.borrower_id)).toEqual(["BOR-0026"]);
  });

  it("rejecting without remarks is blocked and nothing is written", async () => {
    await expect(service.submitDecision({ borrower_id: "BOR-0014", action: "REJECT", remarks: "" }, "a@x.id")).rejects.toEqual(
      new DecisionError(400, REJECT_REMARKS_ERROR),
    );
    expect(await store.listReviews()).toEqual([]);
  });

  it("rejecting with remarks moves the application to Historical → Rejected", async () => {
    await service.submitDecision({ borrower_id: "BOR-0014", action: "REJECT", remarks: "Inventory could not be verified." }, "a@x.id");
    const queue = await service.getQueue();
    expect(queue.rejected[0]).toMatchObject({ borrower_id: "BOR-0014", final_status: "DECLINED_HITL", remarks: "Inventory could not be verified." });
  });

  it("returns 409 for a second decision, including concurrent ones", async () => {
    const attempts = await Promise.allSettled([
      service.submitDecision({ borrower_id: "BOR-0026", action: "ACCEPT" }, "first@x.id"),
      service.submitDecision({ borrower_id: "BOR-0026", action: "REJECT", remarks: "Second analyst disagrees." }, "second@x.id"),
    ]);
    expect(attempts[0].status).toBe("fulfilled");
    expect(attempts[1]).toMatchObject({ status: "rejected", reason: { status: 409 } });
    expect((attempts[1] as PromiseRejectedResult).reason.message).toContain("first@x.id");
    expect(await store.listReviews()).toHaveLength(1);
  });

  it("returns 404 for an unknown borrower", async () => {
    await expect(service.submitDecision({ borrower_id: "BOR-404", action: "ACCEPT" }, "a@x.id")).rejects.toMatchObject({ status: 404 });
  });

  it("keeps the decision when the master update fails, then re-sync repairs it", async () => {
    const mark = vi.spyOn(store, "markApplicationReviewed").mockRejectedValueOnce(new Error("Sheets down"));
    const result = await service.submitDecision({ borrower_id: "BOR-0026", action: "ACCEPT" }, "a@x.id");
    expect(result.sync_pending).toBe(true);

    let queue = await service.getQueue();
    expect(queue.pending.map((row) => row.borrower_id)).toEqual(["BOR-0014"]);
    expect(queue.accepted[0].sync_pending).toBe(true);

    expect(await service.resync()).toEqual({ resynced: ["BOR-0026"], failed: [] });
    queue = await service.getQueue();
    expect(queue.accepted[0].sync_pending).toBe(false);
    expect(await service.resync()).toEqual({ resynced: [], failed: [] });
    expect(mark).toHaveBeenCalledTimes(2);
  });
});
