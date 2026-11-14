import { describe, it, expect } from "vitest";
import { kdsVisible, timerTone } from "@/lib/kds";

const pre = (o: Partial<Parameters<typeof kdsVisible>[0]>) => ({ order_type: "eta_preorder", status: "accepted", fired_manually: false, reservations: { pre_order_paid_amount: 20, is_proximity_verified: false }, ...o });

describe("kds rules", () => {
  it("timer is slate under 8m", () => expect(timerTone(7)).toBe("slate"));
  it("timer is amber from 8m to 14m", () => { expect(timerTone(8)).toBe("amber"); expect(timerTone(14)).toBe("amber"); });
  it("timer flashes red from 15m", () => expect(timerTone(15)).toBe("red"));
  it("QR orders always show", () => expect(kdsVisible({ order_type: "qr_table", status: "incoming", fired_manually: false, reservations: null }, true)).toBe(true));
  it("FOH 'Guest Arrived' fire shows a pre-order as incoming", () => expect(kdsVisible(pre({ status: "incoming", fired_manually: true }), true)).toBe(true));
  it("unapproved pre-order is hidden", () => expect(kdsVisible(pre({ status: "incoming" }), true)).toBe(false));
  it("approved but unverified pre-order is held", () => expect(kdsVisible(pre({}), true)).toBe(false));
  it("paid and GPS verified pre-order auto-fires", () => expect(kdsVisible(pre({ reservations: { pre_order_paid_amount: 20, is_proximity_verified: true } }), true)).toBe(true));
});
