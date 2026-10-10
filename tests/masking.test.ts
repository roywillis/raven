import { describe, expect, it } from "vitest";
import { maskName, maskNik } from "@/domain/masking";

describe("maskNik", () => {
  it("keeps the first and last 4 digits of a 16-digit NIK", () => {
    expect(maskNik("3578010101900020")).toBe("3578****0020");
  });
  it("ignores separators", () => {
    expect(maskNik("3578-0101-0190-0020")).toBe("3578****0020");
  });
  it("fully masks short values and keeps empty values empty", () => {
    expect(maskNik("1234567")).toBe("****");
    expect(maskNik("")).toBe("");
  });
});

describe("maskName", () => {
  it("keeps only the initial of each word", () => {
    expect(maskName("Anton Gunawan")).toBe("A*** G***");
    expect(maskName("  siti   nur  lamadi ")).toBe("S*** N*** L***");
  });
  it("returns an empty string for an empty name", () => {
    expect(maskName("")).toBe("");
  });
});
