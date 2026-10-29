import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MAX_FILES, startTaskShape } from "../src/schemas";

const startTask = z.object(startTaskShape);

describe("startTaskShape", () => {
  it("accepts a small valid input", () => {
    const result = startTask.safeParse({ task: "review", files: ["a.ts"], tools: ["read"] });
    expect(result.success).toBe(true);
  });

  it("rejects an oversized tools array with a field-level issue", () => {
    const result = startTask.safeParse({ task: "review", tools: Array(200_000).fill("nope") });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === "tools")).toBe(true);
  });

  it("rejects an oversized files array with a field-level issue", () => {
    const result = startTask.safeParse({ task: "review", files: Array(200_000).fill(1) });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === "files")).toBe(true);
  });

  it("accepts exactly MAX_FILES files and rejects one more", () => {
    const atLimit = Array.from({ length: MAX_FILES }, (_, i) => `f${i}.ts`);
    expect(startTask.safeParse({ task: "review", files: atLimit }).success).toBe(true);
    expect(startTask.safeParse({ task: "review", files: [...atLimit, "extra.ts"] }).success).toBe(false);
  });
});
