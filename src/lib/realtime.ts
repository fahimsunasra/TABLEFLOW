import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Subscribe to row changes for one restaurant and refetch the given queries. */
export function useLiveTables(
  restaurantId: string | undefined,
  tables: ("tables" | "reservations" | "orders" | "order_items")[],
  queryKeys: unknown[][],
) {
  const qc = useQueryClient();
  const key = tables.join(",") + JSON.stringify(queryKeys);
  useEffect(() => {
    if (!restaurantId) return;
    let ch = supabase.channel(`live-${Math.random().toString(36).slice(2)}`);
    for (const t of tables) {
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: t, filter: `restaurant_id=eq.${restaurantId}` },
        () => queryKeys.forEach((k) => qc.invalidateQueries({ queryKey: k })),
      );
    }
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, key]);
}
