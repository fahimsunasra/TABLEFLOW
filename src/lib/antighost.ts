/** Anti-ghosting protection: shared deposit / ETA / proximity rules. */

export type AntiGhostSettings = {
  /** Required deposit percentage for pre-orders (50 or 100). 0 disables deposits. */
  deposit_pct: number;
  /** Hold kitchen fire until the guest is GPS-verified or FOH fires manually. */
  gps_hold: boolean;
  /** Auto-flag guests with repeated no-shows in the CRM. */
  auto_flag_no_show: boolean;
};

export function antiGhostOf(settings: Record<string, unknown>): AntiGhostSettings {
  const pct = Number(settings["preorder_deposit_pct"]);
  return {
    deposit_pct: pct === 100 ? 100 : 50,
    gps_hold: settings["gps_proximity_hold"] !== false,
    auto_flag_no_show: settings["auto_flag_no_show"] === true,
  };
}

export type ProtectionState = {
  paid: boolean;
  verified: boolean;
  hold: boolean;
  changedEta: boolean;
};

/** KDS may only auto-fire a pre-order when the deposit is paid AND the guest is verified (or hold disabled). */
export function canAutoFire(r: ProtectionState, gpsHold: boolean): boolean {
  return r.paid && (!gpsHold || r.verified);
}

/** Deposit amount owed for a pre-order total, per the restaurant's deposit policy. */
export function depositDue(total: number, pct: number): number {
  return Math.round(total * (pct / 100) * 100) / 100;
}

/** Haversine distance in km between two coordinates. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Geocode-free demo coordinates for the seeded restaurant address (Bistro Aura, Adelaide). */
export const RESTAURANT_COORDS = { lat: -34.921, lng: 138.511 };
