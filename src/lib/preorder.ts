export type FireMode = "immediate" | "auto" | "manual";

export const FIRE_MODES: { value: FireMode; label: string; hint: string }[] = [
  { value: "immediate", label: "Immediately on Approval", hint: "Tickets hit the KDS the moment you approve." },
  { value: "auto", label: "Auto-Scheduled (ETA minus prep time)", hint: "Fires so food is ready as the guest sits down." },
  { value: "manual", label: "Manual FOH Fire", hint: "Held until front of house fires it." },
];

export function fireModeOf(settings: Record<string, unknown>): FireMode {
  const v = settings["preorder_fire_mode"];
  return v === "auto" || v === "manual" ? v : "immediate";
}

/**
 * When an approved pre-order should reach the kitchen.
 * null = now; "infinity" = held for a manual fire.
 */
export function computeFireAt(mode: FireMode, eta: Date | null, prepMins: number, now: Date): string | null {
  if (mode === "immediate") return null;
  if (mode === "manual") return "infinity";
  if (!eta) return null;
  const fire = new Date(eta.getTime() - prepMins * 60000);
  return fire <= now ? null : fire.toISOString();
}

/** Kitchen load label from average minutes active tickets have been open. */
export function kitchenLoad(avgMins: number, activeTickets: number): "Quiet" | "Moderate" | "Busy" {
  if (activeTickets === 0 || avgMins < 6) return "Quiet";
  if (avgMins < 15 && activeTickets < 10) return "Moderate";
  return "Busy";
}
