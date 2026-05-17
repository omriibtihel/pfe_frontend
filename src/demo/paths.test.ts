import { describe, expect, it } from "vitest";

import { isDemoPath, withDemoPrefix } from "./paths";

describe("demo path helpers", () => {
  it("detects demo routes", () => {
    expect(isDemoPath("/demo")).toBe(true);
    expect(isDemoPath("/demo/projects/new")).toBe(true);
    expect(isDemoPath("/demonstration")).toBe(false);
    expect(isDemoPath("/projects/new")).toBe(false);
  });

  it("keeps demo navigation inside the demo subtree", () => {
    expect(withDemoPrefix("/projects/new", "/demo/dashboard")).toBe("/demo/projects/new");
    expect(withDemoPrefix("/dashboard", "/demo/projects/new")).toBe("/demo/dashboard");
  });

  it("does not alter normal or already-prefixed paths", () => {
    expect(withDemoPrefix("/projects/new", "/dashboard")).toBe("/projects/new");
    expect(withDemoPrefix("/demo/projects/new", "/demo/dashboard")).toBe("/demo/projects/new");
    expect(withDemoPrefix("../database", "/demo/projects/demo/import")).toBe("../database");
  });
});
