import { describe, expect, it } from "vitest";
import { serializeHpSpec } from "./hpSerializer";
import type { HpGrid, HpRange } from "@/types/training/hyperparams";

describe("serializeHpSpec", () => {
  it("passes a scalar string through unchanged", () => {
    expect(serializeHpSpec("balanced")).toBe("balanced");
  });

  it("converts HpGrid to a plain array", () => {
    const grid: HpGrid = { kind: "grid", values: [1, 5, 10] };
    expect(serializeHpSpec(grid)).toEqual([1, 5, 10]);
  });

  it("converts HpRange uniform to a __range__ object", () => {
    const range: HpRange = { kind: "range", min: 0.01, max: 100, distribution: "uniform" };
    expect(serializeHpSpec(range)).toEqual({ __range__: true, min: 0.01, max: 100, distribution: "uniform" });
  });

  it("converts HpRange log_uniform with the correct distribution field", () => {
    const range: HpRange = { kind: "range", min: 0.001, max: 10, distribution: "log_uniform" };
    expect(serializeHpSpec(range)).toEqual({ __range__: true, min: 0.001, max: 10, distribution: "log_uniform" });
  });

  it("omits distribution key when HpRange has no distribution", () => {
    const range: HpRange = { kind: "range", min: 1, max: 50 };
    const result = serializeHpSpec(range) as Record<string, unknown>;
    expect(result.__range__).toBe(true);
    expect(result.min).toBe(1);
    expect(result.max).toBe(50);
    expect("distribution" in result).toBe(false);
  });
});
