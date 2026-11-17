import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function etaHold(changes: number, verified: boolean) { return changes >= 1 && !verified; }
export function elapsedDining(since: string, now: number) { return Math.max(0, Math.floor((now - new Date(since).getTime()) / 60000)); }
export const MANUAL_FIRE = { status: "incoming", scheduled_fire_at: null, fired_manually: true } as const;

export function useOperationsSignals(rid: string, key: string, onAlert?: (text: string) => void) {
  const qc = useQueryClient();
  useEffect(() => {
    const refresh = () => qc.invalidateQueries({ queryKey: [key, rid] });
    const ch = supabase.channel(`ops-${key}-${rid}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `restaurant_id=eq.${rid}` }, ({ new: row, old }) => {
        refresh();
        if (key === "foh" && row.status === "ready" && old.status !== "ready") {
          const text = `Order #${row.order_number} ready for service`;
          toast.success(text); onAlert?.(text);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items", filter: `restaurant_id=eq.${rid}` }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "restaurants", filter: `id=eq.${rid}` }, ({ new: row }) => {
        refresh();
        if (key === "foh") { const text = row.kitchen_delay_minutes ? "Kitchen running +5m behind" : "Kitchen delay cleared"; toast(text); onAlert?.(text); }
      }).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [rid, key, qc, onAlert]);
}