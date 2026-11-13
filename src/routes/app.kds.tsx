import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLiveTables } from "@/lib/realtime";
import { settingsOf } from "@/lib/tenant";
import { antiGhostOf } from "@/lib/antighost";
import { RoleGate } from "@/components/tf/RoleGate";
import { Button } from "@/components/ui/button";
import type { Membership } from "@/lib/tenant";

export const Route = createFileRoute("/app/kds")({
  component: () => (
    <div className="dark min-h-screen bg-background text-foreground">
      <RoleGate area="kds">{(m) => <Kds m={m} />}</RoleGate>
    </div>
  ),
});

const COLS = [
  { status: "incoming", title: "Incoming", next: "accepted", action: "Accept" },
  { status: "accepted", title: "Accepted", next: "preparing", action: "Start" },
  { status: "preparing", title: "Preparing", next: "ready", action: "Bump — Ready" },
  { status: "ready", title: "Ready to serve", next: "served", action: "Served" },
] as const;

function useNow() {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setN(Date.now()), 1000); return () => clearInterval(i); }, []);
  return n;
}

function Kds({ m }: { m: Membership }) {
  const rid = m.restaurant_id;
  const qc = useQueryClient();
  const now = useNow();
  const q = useQuery({
    queryKey: ["kds", rid],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, tables(table_number), order_items(*), reservations(pre_order_paid_amount, is_proximity_verified, eta_change_count, customer_name)")
        .eq("restaurant_id", rid).in("status", ["accepted", "preparing", "ready", "incoming"])
        .or(`scheduled_fire_at.is.null,scheduled_fire_at.lte.${new Date().toISOString()}`).order("created_at");
      if (error) throw error;
      const gpsHold = antiGhostOf(settingsOf(m.restaurants)).gps_hold;
      return data.filter((o) => {
        if (o.order_type !== "eta_preorder") return !(o.order_type === "eta_preorder" && o.status === "incoming");
        if (o.status === "incoming") return false;
        if (gpsHold) {
          const r = o.reservations as { pre_order_paid_amount: number; is_proximity_verified: boolean } | null;
          if (!r || r.pre_order_paid_amount <= 0 || !r.is_proximity_verified) return false;
        }
        return true;
      });
    },
  });
  useLiveTables(rid, ["orders", "order_items"], [["kds", rid]]);
  // Scheduled pre-orders appear on their fire time without a row change.
  useEffect(() => { const i = setInterval(() => qc.invalidateQueries({ queryKey: ["kds", rid] }), 30000); return () => clearInterval(i); }, [qc, rid]);

  async function move(id: string, status: string) {
    const { error } = await supabase.from("orders").update({ status: status as never }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (status === "preparing" || status === "ready" || status === "served")
      await supabase.from("order_items").update({ item_status: (status === "served" ? "served" : status) as never }).eq("order_id", id);
    qc.invalidateQueries({ queryKey: ["kds", rid] });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="font-bold tracking-tight">KITCHEN DISPLAY <span className="ml-2 font-normal text-muted-foreground">{m.restaurants.name}</span></div>
        <div className="flex items-center gap-4">
          <span className="tabular text-lg">{new Date(now).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          {m.role !== "kitchen" && <Button asChild size="sm" variant="secondary"><Link to="/app/owner">Exit</Link></Button>}
        </div>
      </header>
      <div className="grid flex-1 gap-4 p-4 md:grid-cols-4">
        {COLS.map((c) => (
          <section key={c.status} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{c.title} · {q.data?.filter((o) => o.status === c.status).length ?? 0}</h2>
            {q.data?.filter((o) => o.status === c.status).map((o) => {
              const mins = Math.floor((now - new Date(o.created_at).getTime()) / 60000);
              const secs = Math.floor((now - new Date(o.created_at).getTime()) / 1000) % 60;
              const tone = mins >= 15 ? "border-destructive" : mins >= 8 ? "border-warning" : "border-success";
              return (
                <article key={o.id} className={`rounded-xl border-t-4 bg-card p-4 ${tone}`}>
                  <div className="flex items-baseline justify-between">
                    <span className="tabular text-xl font-bold">#{o.order_number}</span>
                    <span className={`tabular text-lg ${mins >= 15 ? "text-destructive" : mins >= 8 ? "text-warning" : "text-success"}`}>{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{(o.tables as { table_number: string } | null)?.table_number ?? "Takeaway"} · {o.order_type.replace("_", " ")}</div>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {o.order_items.map((i) => (
                      <li key={i.id} className="flex justify-between gap-2">
                        <span><span className="tabular font-bold">{i.quantity}×</span> {i.name}{i.special_instructions && <span className="block text-xs text-warning">{i.special_instructions}</span>}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{i.station}</span>
                      </li>
                    ))}
                  </ul>
                  {o.customer_notes && <p className="mt-2 rounded bg-muted p-2 text-xs">{o.customer_notes}</p>}
                  <Button className="mt-4 h-12 w-full" variant={c.status === "preparing" ? "success" : "electric"} onClick={() => move(o.id, c.next)}>{c.action}</Button>
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
