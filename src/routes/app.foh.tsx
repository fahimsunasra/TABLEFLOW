import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLiveTables } from "@/lib/realtime";
import { label, TABLE_STATUS_CLASS, TABLE_STATUSES } from "@/lib/status";
import { RoleGate } from "@/components/tf/RoleGate";
import { Logo } from "@/components/tf/Logo";
import { Button } from "@/components/ui/button";
import type { Membership } from "@/lib/tenant";

export const Route = createFileRoute("/app/foh")({
  component: () => <RoleGate area="foh">{(m) => <Foh m={m} />}</RoleGate>,
});

function Foh({ m }: { m: Membership }) {
  const rid = m.restaurant_id;
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [sel, setSel] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["foh", rid],
    queryFn: async () => {
      const [t, r] = await Promise.all([
        supabase.from("tables").select("*").eq("restaurant_id", rid).order("table_number"),
        supabase.from("reservations").select("*").eq("restaurant_id", rid).eq("booking_date", today).not("status", "in", "(completed,cancelled,no_show)").order("arrival_time"),
      ]);
      return { tables: t.data ?? [], res: r.data ?? [] };
    },
  });
  useLiveTables(rid, ["tables", "reservations"], [["foh", rid]]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["foh", rid] });

  async function setTable(id: string, status: string) {
    const { error } = await supabase.from("tables").update({ status: status as never }).eq("id", id);
    if (error) toast.error(error.message);
    setSel(null);
    refresh();
  }
  async function advance(id: string, status: "checked_in" | "seated") {
    const { error } = await supabase.from("reservations").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    refresh();
  }
  const selected = q.data?.tables.find((t) => t.id === sel);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b bg-card px-6 py-3">
        <div className="flex items-center gap-4"><Logo /><span className="text-sm text-muted-foreground">Front of House · {m.restaurants.name}</span></div>
        {m.role !== "foh" && <Button asChild variant="outline" size="sm"><Link to="/app/owner">Dashboard</Link></Button>}
      </header>
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
        <div className="grid grid-cols-3 gap-4 md:grid-cols-4">
          {q.data?.tables.map((t) => (
            <button key={t.id} onClick={() => setSel(t.id)} className={`min-h-32 rounded-2xl border-2 p-4 text-left transition active:scale-95 ${TABLE_STATUS_CLASS[t.status]} ${sel === t.id ? "ring-4 ring-electric" : ""}`}>
              <div className="tabular text-2xl font-bold">{t.table_number}</div>
              <div className="text-sm">{t.zone} · {t.capacity}p</div>
              <div className="mt-3 text-sm font-semibold">{label(t.status)}</div>
            </button>
          ))}
        </div>
        <aside className="space-y-4">
          {selected && (
            <div className="rounded-2xl border bg-card p-4 shadow-card">
              <div className="mb-3 font-semibold">Update {selected.table_number}</div>
              <div className="grid grid-cols-2 gap-2">
                {TABLE_STATUSES.map((s) => (
                  <Button key={s} variant={s === selected.status ? "electric" : "outline"} className="h-12" onClick={() => setTable(selected.id, s)}>{label(s)}</Button>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="mb-3 font-semibold">Arrivals today</div>
            <ul className="space-y-2">
              {q.data?.res.map((r) => (
                <li key={r.id} className="rounded-xl border p-3">
                  <div className="flex justify-between"><span className="font-medium">{r.customer_name}</span><span className="tabular text-sm">{r.arrival_time.slice(0, 5)}</span></div>
                  <div className="text-xs text-muted-foreground">{r.party_size} guests · {label(r.status)}{r.dietary_notes ? ` · ${r.dietary_notes}` : ""}</div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => advance(r.id, "checked_in")}>Check in</Button>
                    <Button size="sm" variant="success" onClick={() => advance(r.id, "seated")}>Seat</Button>
                  </div>
                </li>
              ))}
              {q.data && !q.data.res.length && <li className="text-sm text-muted-foreground">No more arrivals.</li>}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
