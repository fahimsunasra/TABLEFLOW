import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { money, useMembership } from "@/lib/tenant";
import { useLiveTables } from "@/lib/realtime";
import { label, TABLE_STATUS_CLASS } from "@/lib/status";
import { PageHeader, Panel, Pill } from "@/components/tf/Ui";

export const Route = createFileRoute("/app/owner/")({ component: Overview });

function Overview() {
  const { data: m } = useMembership();
  const rid = m!.restaurant_id;
  const today = new Date().toISOString().slice(0, 10);
  const q = useQuery({
    queryKey: ["overview", rid],
    queryFn: async () => {
      const [t, r, o] = await Promise.all([
        supabase.from("tables").select("*").eq("restaurant_id", rid).order("table_number"),
        supabase.from("reservations").select("*").eq("restaurant_id", rid).eq("booking_date", today).order("arrival_time"),
        supabase.from("orders").select("*").eq("restaurant_id", rid).order("created_at", { ascending: false }).limit(20),
      ]);
      return { tables: t.data ?? [], res: r.data ?? [], orders: o.data ?? [] };
    },
  });
  useLiveTables(rid, ["tables", "reservations", "orders"], [["overview", rid]]);
  const d = q.data;
  const occupied = d?.tables.filter((t) => t.status !== "available" && t.status !== "cleaning").length ?? 0;
  const revenue = d?.orders.reduce((s, o) => s + Number(o.total_amount), 0) ?? 0;
  const active = d?.orders.filter((o) => ["incoming", "accepted", "preparing", "ready"].includes(o.status)).length ?? 0;
  const covers = d?.res.reduce((s, r) => s + r.party_size, 0) ?? 0;

  return (
    <>
      <PageHeader title={`Good evening, ${m!.full_name.split(" ")[0]}`} sub={`${m!.restaurants.name} · live overview`} />
      <div className="grid gap-4 md:grid-cols-4">
        {[["Tables in use", `${occupied}/${d?.tables.length ?? 0}`], ["Active orders", active], ["Covers booked today", covers], ["Recent revenue", money(revenue, m!.restaurants.currency)]].map(([l, v]) => (
          <Panel key={String(l)}><div className="text-sm text-muted-foreground">{l}</div><div className="tabular mt-2 text-3xl font-bold">{v}</div></Panel>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-4 font-semibold">Tonight's reservations</h2>
          <ul className="divide-y">
            {d?.res.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                <span><span className="tabular mr-3 text-muted-foreground">{r.arrival_time.slice(0, 5)}</span>{r.customer_name} · {r.party_size}p</span>
                <Pill>{label(r.status)}</Pill>
              </li>
            ))}
            {d && !d.res.length && <li className="py-4 text-sm text-muted-foreground">No bookings today.</li>}
          </ul>
        </Panel>
        <Panel>
          <h2 className="mb-4 font-semibold">Floor status</h2>
          <div className="grid grid-cols-4 gap-2">
            {d?.tables.map((t) => (
              <div key={t.id} className={`rounded-lg border p-2 text-center ${TABLE_STATUS_CLASS[t.status]}`}>
                <div className="tabular text-sm font-bold">{t.table_number}</div>
                <div className="text-[10px]">{label(t.status)}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
