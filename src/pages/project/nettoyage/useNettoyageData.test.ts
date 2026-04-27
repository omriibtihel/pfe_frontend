import { describe, it, expect, vi } from "vitest";

vi.mock("react-router-dom", () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("@/services/dataService", () => ({
  default: { getVersions: vi.fn(), getAlertConfig: vi.fn() },
}));
vi.mock("@/services/datasetService", () => ({ default: {} }));
vi.mock("@/services/apiClient", () => ({
  default: { get: vi.fn(), postJson: vi.fn(), putJson: vi.fn() },
}));

import { buildMetaMap } from "@/pages/project/nettoyage/useNettoyageData";

describe("buildMetaMap", () => {
  describe("stats field mapping", () => {
    it("maps all 5 stats fields when present in server meta", () => {
      const serverMeta = [
        {
          name: "age",
          dtype: "float64",
          kind: "numeric",
          missing: 0,
          unique: 50,
          total: 100,
          sample: ["25", "30"],
          skewness: 1.5,
          outlier_count: 3,
          outlier_ratio: 0.03,
          has_negative: false,
          parasites: null,
        },
      ];

      const result = buildMetaMap(["age"], { age: "float64" }, serverMeta);

      const meta = result["age"];
      expect(meta.skewness).toBe(1.5);
      expect(meta.outlier_count).toBe(3);
      expect(meta.outlier_ratio).toBe(0.03);
      expect(meta.has_negative).toBe(false);
      expect(meta.parasites).toBeNull();
    });

    it("maps parasites object with all subfields", () => {
      const serverMeta = [
        {
          name: "amount",
          dtype: "object",
          kind: "numeric",
          missing: 0,
          unique: 10,
          total: 20,
          sample: [],
          parasites: { count: 2, distinct: ["N/A", "?"], convertible_ratio: 0.9 },
          skewness: null,
          outlier_count: null,
          outlier_ratio: null,
          has_negative: null,
        },
      ];

      const result = buildMetaMap(["amount"], { amount: "object" }, serverMeta);

      const meta = result["amount"];
      expect(meta.parasites).not.toBeNull();
      expect(meta.parasites!.count).toBe(2);
      expect(meta.parasites!.distinct).toEqual(["N/A", "?"]);
      expect(meta.parasites!.convertible_ratio).toBe(0.9);
    });

    it("falls back to null when stats fields are absent from server entry", () => {
      const serverMeta = [
        {
          name: "score",
          dtype: "float64",
          kind: "numeric",
          missing: 0,
          unique: 10,
          total: 50,
          sample: [],
          // skewness, outlier_count, outlier_ratio, has_negative, parasites all absent
        },
      ];

      const result = buildMetaMap(["score"], { score: "float64" }, serverMeta as any);

      const meta = result["score"];
      expect(meta.skewness).toBeNull();
      expect(meta.outlier_count).toBeNull();
      expect(meta.outlier_ratio).toBeNull();
      expect(meta.has_negative).toBeNull();
      expect(meta.parasites).toBeNull();
    });

    it("keeps null stats fields as null (not converted to undefined)", () => {
      const serverMeta = [
        {
          name: "col",
          dtype: "float64",
          kind: "numeric",
          missing: 2,
          unique: 5,
          total: 10,
          sample: [],
          skewness: null,
          outlier_count: null,
          outlier_ratio: null,
          has_negative: null,
          parasites: null,
        },
      ];

      const result = buildMetaMap(["col"], { col: "float64" }, serverMeta);

      const meta = result["col"];
      expect(meta.skewness).toBeNull();
      expect(meta.outlier_count).toBeNull();
      expect(meta.outlier_ratio).toBeNull();
      expect(meta.has_negative).toBeNull();
    });
  });

  describe("robustness", () => {
    it("does not throw when serverMeta is undefined", () => {
      expect(() => buildMetaMap(["x"], { x: "int64" }, undefined)).not.toThrow();
    });

    it("returns a fallback entry for every column when serverMeta is undefined", () => {
      const result = buildMetaMap(["x", "y"], { x: "int64", y: "object" }, undefined);

      expect(result["x"]).toBeDefined();
      expect(result["x"].name).toBe("x");
      expect(result["y"]).toBeDefined();
      expect(result["y"].name).toBe("y");
    });

    it("does not throw when serverMeta is an empty array", () => {
      expect(() => buildMetaMap(["a"], { a: "float64" }, [])).not.toThrow();
    });

    it("fills fallback entry for columns absent from serverMeta", () => {
      const serverMeta = [
        { name: "a", dtype: "float64", kind: "numeric", missing: 0, unique: 5, total: 10, sample: [] },
      ];

      const result = buildMetaMap(["a", "b"], { a: "float64", b: "object" }, serverMeta as any);

      expect(result["a"]).toBeDefined();
      expect(result["b"]).toBeDefined();
      expect(result["b"].name).toBe("b");
    });

    it("skips serverMeta entries without a name", () => {
      const serverMeta = [
        { dtype: "float64", kind: "numeric", missing: 0, unique: 5, total: 10, sample: [] },
      ] as any;

      expect(() => buildMetaMap(["x"], { x: "float64" }, serverMeta)).not.toThrow();
    });
  });

  describe("kind normalization", () => {
    it("normalizes bool kind to binary", () => {
      const serverMeta = [
        { name: "flag", dtype: "bool", kind: "bool", missing: 0, unique: 2, total: 10, sample: [] },
      ];

      const result = buildMetaMap(["flag"], { flag: "bool" }, serverMeta as any);

      expect(result["flag"].kind).toBe("binary");
    });

    it("falls back to dtype inference when kind is absent from server entry", () => {
      const serverMeta = [
        { name: "score", dtype: "float64", missing: 0, unique: 10, total: 50, sample: [] },
      ];

      const result = buildMetaMap(["score"], { score: "float64" }, serverMeta as any);

      expect(result["score"].kind).toBe("numeric");
    });

    it("uses dtype from dtypes map when server entry has no dtype", () => {
      const serverMeta = [
        { name: "val", kind: "numeric", missing: 0, unique: 5, total: 10, sample: [] },
      ];

      const result = buildMetaMap(["val"], { val: "float64" }, serverMeta as any);

      expect(result["val"].dtype).toBe("float64");
    });
  });
});
