import { describe, it, expect } from "vitest";
import { canAutoFire, depositDue, distanceKm, antiGhostOf } from "@/lib/antighost";

const s = (paid: boolean, verified: boolean) => ({ paid, verified, hold: true, changedEta: false });

describe("anti-ghosting", () => {
  it("does not auto-fire when deposit unpaid", () => expect(canAutoFire(s(false, true), true)).toBe(false));
  it("does not auto-fire paid but unverified guest when GPS hold on", () => expect(canAutoFire(s(true, false), true)).toBe(false));
  it("auto-fires paid and verified guest", () => expect(canAutoFire(s(true, true), true)).toBe(true));
  it("50% deposit of $80 is $40", () => expect(depositDue(80, 50)).toBe(40));
  it("deposit defaults to 50% and supports 100%", () => {
    expect(antiGhostOf({}).deposit_pct).toBe(50);
    expect(antiGhostOf({ preorder_deposit_pct: 100 }).deposit_pct).toBe(100);
  });
  it("1.5km away is within 2km", () => expect(distanceKm(-34.921, 138.511, -34.921 + 0.0135, 138.511)).toBeLessThan(2));
});
