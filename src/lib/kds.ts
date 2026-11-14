import { canAutoFire } from "@/lib/antighost";

export const STATIONS = ["Main Kitchen", "Grill", "Starters", "Desserts", "Bar"] as const;
export const STATION_TAG: Record<string, string> = {
  "Main Kitchen": "MAIN", Grill: "GRILL", Starters: "STARTERS", Desserts: "DESSERT", Bar: "BAR",
};
export const SOURCE_TAG: Record<string, string> = { qr_table: "QR", foh_pos: "FOH", eta_preorder: "PRE-ORDER" };

/** Ticket header tone by elapsed minutes: slate 0-8m, amber 8-14m, flashing red 15m+. */
export function timerTone(mins: number): "slate" | "amber" | "red" {
  if (mins >= 15) return "red";
  if (mins >= 8) return "amber";
  return "slate";
}

type KdsOrder = {
  order_type: string;
  status: string;
  fired_manually: boolean;
  reservations: { pre_order_paid_amount: number; is_proximity_verified: boolean } | null;
};

/** Whether an order belongs on the kitchen board. Pre-orders need a manual FOH fire or pass anti-ghosting rules. */
export function kdsVisible(o: KdsOrder, gpsHold: boolean): boolean {
  if (o.order_type !== "eta_preorder") return true;
  if (o.fired_manually) return true;
  if (o.status === "incoming") return false; // awaiting FOH approval
  const r = o.reservations;
  return !!r && canAutoFire({ paid: r.pre_order_paid_amount > 0, verified: r.is_proximity_verified, hold: gpsHold, changedEta: false }, gpsHold);
}
