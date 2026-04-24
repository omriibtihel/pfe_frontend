import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock apiClient ────────────────────────────────────────────────────────────

const getBlob = vi.fn();

vi.mock("@/services/apiClient", () => ({
  default: { getBlob },
}));

// ── Import service after mocks ────────────────────────────────────────────────

// Dynamic import ensures mocks are applied before module evaluation.
async function getService() {
  const { trainingService } = await import("@/services/trainingService");
  return trainingService;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("trainingService.downloadResults — FE-04", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("test_download_resolves_on_first_attempt", async () => {
    const fakeBlob = new Blob(["data"], { type: "application/json" });
    getBlob.mockResolvedValue({ blob: fakeBlob });

    const svc = await getService();
    const result = await svc.downloadResults("proj1", "sess1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.blob).toBe(fakeBlob);
    }
    // Only the primary endpoint was called
    expect(getBlob).toHaveBeenCalledTimes(1);
    expect(getBlob).toHaveBeenCalledWith(expect.stringContaining("/download"));
  });

  it("test_download_falls_back_to_export", async () => {
    const fakeBlob = new Blob(["fallback"], { type: "application/json" });
    getBlob
      .mockRejectedValueOnce(new Error("primary failed"))
      .mockResolvedValue({ blob: fakeBlob });

    const svc = await getService();
    const result = await svc.downloadResults("proj1", "sess1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.blob).toBe(fakeBlob);
    }
    expect(getBlob).toHaveBeenCalledTimes(2);
    expect(getBlob).toHaveBeenLastCalledWith(expect.stringContaining("/export"));
  });

  it("test_download_resolves_false_when_both_fail", async () => {
    getBlob
      .mockRejectedValueOnce(new Error("primary failed"))
      .mockRejectedValueOnce(new Error("export also failed"));

    const svc = await getService();
    const result = await svc.downloadResults("proj1", "sess1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("export also failed");
    }
  });

  it("test_download_never_rejects", async () => {
    getBlob.mockRejectedValue(new Error("all endpoints down"));

    const svc = await getService();

    // Must not throw — always resolves
    await expect(svc.downloadResults("proj1", "sess1")).resolves.toBeDefined();
  });
});
