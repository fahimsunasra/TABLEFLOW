import { describe, expect, it } from "vitest";
import { canAccess, homeFor } from "@/lib/tenant";

describe("staff role access", () => {
  it("kitchen staff can open the KDS but not the owner dashboard or FOH", () => {
    expect(canAccess("kitchen", "kds")).toBe(true);
    expect(canAccess("kitchen", "owner")).toBe(false);
    expect(canAccess("kitchen", "foh")).toBe(false);
  });
  it("FOH staff can open FOH only", () => {
    expect(canAccess("foh", "foh")).toBe(true);
    expect(canAccess("foh", "kds")).toBe(false);
    expect(canAccess("foh", "owner")).toBe(false);
  });
  it("owners and managers can open every area", () => {
    for (const r of ["owner", "manager"] as const) for (const a of ["owner", "foh", "kds"] as const) expect(canAccess(r, a)).toBe(true);
  });
  it("each role lands on its own home screen", () => {
    expect(homeFor("kitchen")).toBe("/app/kds");
    expect(homeFor("foh")).toBe("/app/foh");
    expect(homeFor("manager")).toBe("/app/owner");
  });
});
