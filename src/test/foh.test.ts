import { describe, it, expect } from "vitest";
import { etaHold, MANUAL_FIRE, elapsedDining } from "@/lib/foh";
describe("FOH operations", () => {
  it("holds changed ETAs without GPS verification", () => { expect(etaHold(1, false)).toBe(true); expect(etaHold(0, false)).toBe(false); expect(etaHold(1, true)).toBe(false); });
  it("manual arrival fires into Incoming without a schedule", () => { expect(MANUAL_FIRE.status).toBe("incoming"); expect(MANUAL_FIRE.scheduled_fire_at).toBe(null); expect(MANUAL_FIRE.fired_manually).toBe(true); });
  it("shows elapsed dining minutes", () => { expect(elapsedDining("2026-11-17T03:00:00Z", Date.parse("2026-11-17T03:24:00Z"))).toBe(24); });
});