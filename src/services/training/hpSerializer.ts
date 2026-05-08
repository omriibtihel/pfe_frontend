import type { HpGrid, HpRange, ModelHyperparamSpec } from "@/types/training/hyperparams";

export function serializeHpSpec(spec: ModelHyperparamSpec): unknown {
  if (typeof spec !== "object" || spec === null) {
    return spec;
  }
  if (spec.kind === "grid") {
    return (spec as HpGrid).values;
  }
  if (spec.kind === "range") {
    const r = spec as HpRange;
    const out: Record<string, unknown> = { __range__: true, min: r.min, max: r.max };
    if (r.distribution !== undefined) {
      out.distribution = r.distribution;
    }
    return out;
  }
  return spec;
}
