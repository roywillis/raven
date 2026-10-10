import { describe, expect, it } from "vitest";
import { errorResponse } from "@/auth/http";

/** A same-named class from another module copy (as created by a different bundle layer). */
class DecisionError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "DecisionError";
  }
}

describe("errorResponse", () => {
  it("maps errors by name, so copies of the error classes from other bundle layers still match", async () => {
    const response = errorResponse(new DecisionError(409, "already decided"));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "already decided" });
  });

  it("hides details of unexpected errors", async () => {
    const response = errorResponse(new Error("secret internals"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unexpected server error." });
  });
});
