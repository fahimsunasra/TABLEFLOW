import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLiveTables } from "@/lib/realtime";

export type Activity = { id: string; at: string; kind: "order" | "reservation"; title: string; detail: string };

export function useActivityFeed(rid: string) {
  const q = useQuery({
    queryKey: ["activity", rid],
    queryFn: async (): Promise<Activity[]> => {
      const [o, r] = await Promise.all([
        supabase.from("orders").select("id,order_number,order_type,status,total_amount,created_at,tables(table_number)").eq("restaurant_id", rid).order("created_at", { ascending: false }).limit(12),
        supabase.from("reservations").select("id,customer_name,party_size,status,arrival_time,booking_date,created_at").eq("restaurant_id", rid).order("created_at", { ascending: false }).limit(12),
      ]);
      const a: Activity[] = [
        ...(o.data ?? []).map((x) => ({
          id: `o-${x.id}`, at: x.created_at, kind: "order" as const,
          title: `Order #${x.order_number} · ${x.status}`,
          detail: `${(x.tables as { table_number: string } | null)?.table_number ?? x.order_type.replace("_", " ")} · $${Number(x.total_amount).toFixed(2)}`,
        })),
        ...(r.data ?? []).map((x) => ({
          id: `r-${x.id}`, at: x.created_at, kind: "reservation" as const,
          title: `${x.customer_name} · ${x.status.replace("_", " ")}`,
          detail: `${x.party_size} guests · ${x.booking_date} ${x.arrival_time.slice(0, 5)}`,
        })),
      ];
      return a.sort((p, n) => n.at.localeCompare(p.at)).slice(0, 15);
    },
  });
  useLiveTables(rid, ["orders", "reservations"], [["activity", rid]]);
  return q;
}

export function ago(iso: string, now = Date.now()) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}
