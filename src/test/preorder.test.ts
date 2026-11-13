import { describe, expect, it } from "vitest";
import { computeFireAt, kitchenLoad } from "@/lib/preorder";
import { rangeFor } from "@/lib/date-range";

const now = new Date("2026-11-13T18:00:00Z");

describe("pre-order firing", () => {
  it("immediate mode fires now", () => expect(computeFireAt("immediate", new Date("2026-11-13T19:00:00Z"), 20, now)).toBeNull());
  it("manual mode holds the ticket", () => expect(computeFireAt("manual", null, 20, now)).toBe("infinity"));
  it("auto mode fires at ETA minus prep time", () =>
    expect(computeFireAt("auto", new Date("2026-11-13T19:00:00Z"), 20, now)).toBe("2026-11-13T18:40:00.000Z"));
  it("auto mode fires now when ETA minus prep is already past", () =>
    expect(computeFireAt("auto", new Date("2026-11-13T18:10:00Z"), 20, now)).toBeNull());
});

describe("kitchen load", () => {
  it("is Moderate at 11 minutes average with a few tickets", () => expect(kitchenLoad(11, 4)).toBe("Moderate"));
  it("is Busy at 15+ minutes", () => expect(kitchenLoad(16, 4)).toBe("Busy"));
  it("is Quiet with no tickets", () => expect(kitchenLoad(30, 0)).toBe("Quiet"));
});

describe("date filter", () => {
  it("This Week starts on Monday", () => {
    const r = rangeFor("week", new Date(2026, 10, 13, 12));
    expect(r.from.getDay()).toBe(1);
    expect(r.from.getDate()).toBe(9);
  });
  it("Yesterday covers exactly one day", () => {
    const r = rangeFor("yesterday", new Date(2026, 10, 13, 12));
    expect(r.from.getDate()).toBe(12);
    expect(r.to.getDate()).toBe(13);
  });
});
