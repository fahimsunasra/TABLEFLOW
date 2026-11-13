import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { addDays, format, startOfDay, startOfWeek } from "date-fns";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money, settingsOf, useMembership } from "@/lib/tenant";
import { useLiveTables } from "@/lib/realtime";
import { useDateRange } from "@/lib/date-range";
import { computeFireAt, fireModeOf, FIRE_MODES } from "@/lib/preorder";
import { PageHeader, Panel } from "@/components/tf/Ui";
import { ActivityList } from "@/components/tf/ActivityList";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/owner/overview")({ component: Overview });

const C = { electric: "var(--electric)", success: "var(--success)", warning: "var(--warning)", navy: "var(--navy)", muted: "var(--muted-foreground)", border: "var(--border)" };
const tip = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 } };

function Overview() {
  const { data: m } = useMembership();
  const rid = m!.restaurant_id;
  const cur = m!.restaurants.currency;
  const { from, to } = useDateRange();
  const qc = useQueryClient();
  const fireMode = fireModeOf(settingsOf(m!.restaurants));
  const k = [from.toISOString(), to.toISOString()];

  const q = useQuery({
    queryKey: ["ov", rid, ...k],
    queryFn: async () => {
      const [o, r, t, items] = await Promise.all([
        supabase.from("orders").select("id,order_type,status,total_amount,created_at").eq("restaurant_id", rid).gte("created_at", k[0]!).lt("created_at", k[1]!).neq("status", "cancelled"),
        supabase.from("reservations").select("id,party_size,status,booking_date").eq("restaurant_id", rid).gte("booking_date", format(from, "yyyy-MM-dd")).lt("booking_date", format(to, "yyyy-MM-dd")),
        supabase.from("tables").select("id,status,status_changed_at").eq("restaurant_id", rid),
        supabase.from("order_items").select("name,quantity,unit_price,orders!inner(created_at,status)").eq("restaurant_id", rid).gte("orders.created_at", k[0]!).lt("orders.created_at", k[1]!).neq("orders.status", "cancelled"),
      ]);
      return { orders: o.data ?? [], res: r.data ?? [], tables: t.data ?? [], items: items.data ?? [] };
    },
  });

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekly = useQuery({
    queryKey: ["ov-week", rid],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("total_amount,created_at").eq("restaurant_id", rid).gte("created_at", addDays(weekStart, -7).toISOString()).neq("status", "cancelled");
      return data ?? [];
    },
  });

  const live = useQuery({
    queryKey: ["ov-live", rid],
    queryFn: async () => {
      const [pre, kitchen] = await Promise.all([
        supabase.from("orders").select("id,order_number,total_amount,customer_notes,created_at,reservations(customer_name,party_size,arrival_time,booking_date,eta_time),order_items(name,quantity,menu_items(prep_time_mins))")
          .eq("restaurant_id", rid).eq("order_type", "eta_preorder").eq("status", "incoming").order("created_at"),
        supabase.from("order_items").select("station,item_status,orders!inner(status)").eq("restaurant_id", rid).in("orders.status", ["incoming", "accepted", "preparing"]).neq("item_status", "served"),
      ]);
      return { pre: pre.data ?? [], kitchen: kitchen.data ?? [] };
    },
  });
  useLiveTables(rid, ["orders", "reservations", "tables", "order_items"], [["ov", rid, ...k], ["ov-live", rid], ["ov-week", rid]]);

  const d = q.data;
  const stats = useMemo(() => {
    const orders = d?.orders ?? [];
    const by = (t: string) => orders.filter((o) => o.order_type === t).length;
    const active = d?.tables.filter((t) => !["available", "cleaning"].includes(t.status)).length ?? 0;
    const waiting = d?.tables.filter((t) => t.status === "waiting_food") ?? [];
    const avgWait = waiting.length ? Math.round(waiting.reduce((s, t) => s + (Date.now() - new Date(t.status_changed_at).getTime()) / 60000, 0) / waiting.length) : 0;
    const hours = Array.from({ length: 13 }, (_, i) => ({ hour: `${i + 11}:00`, revenue: 0, orders: 0 }));
    for (const o of orders) {
      const h = new Date(o.created_at).getHours() - 11;
      const slot = hours[h];
      if (slot) { slot.revenue += Number(o.total_amount); slot.orders += 1; }
    }
    const dishMap = new Map<string, number>();
    for (const i of d?.items ?? []) dishMap.set(i.name, (dishMap.get(i.name) ?? 0) + i.quantity);
    const dishes = [...dishMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }));
    return {
      revenue: orders.reduce((s, o) => s + Number(o.total_amount), 0), count: orders.length,
      qr: by("qr_table"), foh: by("foh_pos"), pre: by("eta_preorder"),
      reservations: d?.res.filter((r) => r.status !== "cancelled").length ?? 0, covers: d?.res.reduce((s, r) => s + r.party_size, 0) ?? 0,
      active, available: (d?.tables.length ?? 0) - active, avgWait, hours, dishes,
    };
  }, [d]);

  const weekData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => ({ day: format(addDays(weekStart, i), "EEE"), "This week": 0, "Last week": 0 }));
    for (const o of weekly.data ?? []) {
      const diff = Math.floor((startOfDay(new Date(o.created_at)).getTime() - weekStart.getTime()) / 86400000);
      const row = days[(diff + 7) % 7];
      if (row) row[diff >= 0 ? "This week" : "Last week"] += Number(o.total_amount);
    }
    return days;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekly.data]);

  const stations = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of live.data?.kitchen ?? []) m.set(i.station, (m.get(i.station) ?? 0) + 1);
    return ["Main Kitchen", "Grill", "Starters", "Desserts", "Bar"].map((s) => ({ s, n: m.get(s) ?? 0 }));
  }, [live.data]);

  async function decide(o: NonNullable<typeof live.data>["pre"][number], approve: boolean) {
    if (!approve) {
      const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", o.id);
      if (error) toast.error(error.message); else toast("Pre-order rejected");
    } else {
      const res = o.reservations as { eta_time: string | null; booking_date: string; arrival_time: string } | null;
      const eta = res?.eta_time ? new Date(res.eta_time) : res ? new Date(`${res.booking_date}T${res.arrival_time}`) : null;
      const prep = Math.max(0, ...o.order_items.map((i) => (i.menu_items as { prep_time_mins: number } | null)?.prep_time_mins ?? 10));
      const fireAt = computeFireAt(fireMode, eta, prep, new Date());
      const { error } = await supabase.from("orders").update({ status: "accepted", scheduled_fire_at: fireAt }).eq("id", o.id);
      if (error) toast.error(error.message);
      else toast.success(fireAt === null ? "Approved — sent to kitchen" : fireAt === "infinity" ? "Approved — held for FOH fire" : `Approved — fires at ${format(new Date(fireAt), "HH:mm")}`);
    }
    qc.invalidateQueries({ queryKey: ["ov-live", rid] });
  }

  const maxStation = Math.max(1, ...stations.map((s) => s.n));

  return (
    <>
      <PageHeader title="Overview" sub={`${m!.restaurants.name} · ${format(from, "d MMM")}${addDays(from, 1).getTime() === to.getTime() ? "" : ` – ${format(addDays(to, -1), "d MMM")}`}`} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total Revenue" value={money(stats.revenue, cur)} sub={`${stats.count} paid & open orders`} />
        <Kpi label="Total Orders" value={stats.count} sub={<><b className="tabular">{stats.qr}</b> QR · <b className="tabular">{stats.foh}</b> FOH · <b className="tabular">{stats.pre}</b> Pre-Order</>} />
        <Kpi label="Total Reservations" value={stats.reservations} sub={`${stats.covers} covers booked`} />
        <Kpi label="Tables Active / Available" value={`${stats.active} / ${stats.available}`} sub={`Avg wait for food: ${stats.avgWait}m`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <h2 className="mb-4 font-semibold">Hourly sales & order volume</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <ComposedChart data={stats.hours}>
                <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.electric} stopOpacity={0.35} /><stop offset="100%" stopColor={C.electric} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke={C.border} vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...tip} formatter={(v: number, n) => (n === "Revenue" ? money(v, cur) : v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="r" dataKey="orders" name="Orders" fill={C.navy} radius={[4, 4, 0, 0]} barSize={14} />
                <Area yAxisId="l" type="monotone" dataKey="revenue" name="Revenue" stroke={C.electric} strokeWidth={2} fill="url(#rev)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <h2 className="mb-4 font-semibold">Top 5 dishes</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={stats.dishes} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                <Tooltip {...tip} />
                <Bar dataKey="qty" name="Sold" fill={C.success} radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel>
          <h2 className="mb-4 font-semibold">Weekly revenue</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={weekData}>
                <CartesianGrid stroke={C.border} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip {...tip} formatter={(v: number) => money(v, cur)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Last week" fill={C.border} radius={[4, 4, 0, 0]} />
                <Bar dataKey="This week" fill={C.electric} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Pending pre-order approvals</h2>
            <span className="text-xs text-muted-foreground">{FIRE_MODES.find((f) => f.value === fireMode)?.label}</span>
          </div>
          <ul className="space-y-3">
            {live.data?.pre.map((o) => {
              const r = o.reservations as { customer_name: string; party_size: number; arrival_time: string } | null;
              return (
                <li key={o.id} className="rounded-xl border p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">{r?.customer_name ?? "Guest"} · {r?.party_size ?? "?"}p</span>
                    <span className="tabular text-xs text-muted-foreground">#{o.order_number} · ETA {r?.arrival_time.slice(0, 5)}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{o.order_items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="tabular mr-auto text-sm font-semibold">{money(o.total_amount, cur)}</span>
                    <Button size="sm" variant="outline" onClick={() => decide(o, false)}><X />Reject</Button>
                    <Button size="sm" variant="success" onClick={() => decide(o, true)}><Check />Approve</Button>
                  </div>
                </li>
              );
            })}
            {live.data && !live.data.pre.length && <li className="text-sm text-muted-foreground">No pre-orders waiting.</li>}
          </ul>
        </Panel>
        <Panel>
          <h2 className="mb-4 font-semibold">Kitchen workload</h2>
          <ul className="space-y-3">
            {stations.map(({ s, n }) => (
              <li key={s}>
                <div className="flex justify-between text-sm"><span>{s}</span><span className="tabular">{n} items</span></div>
                <div className="mt-1 h-2 rounded-full bg-muted"><div className={`h-2 rounded-full ${n >= 6 ? "bg-destructive" : n >= 3 ? "bg-warning" : "bg-success"}`} style={{ width: `${(n / maxStation) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
          <h2 className="mb-3 mt-6 font-semibold">Live activity</h2>
          <div className="max-h-72 overflow-y-auto pr-1"><ActivityList rid={rid} /></div>
        </Panel>
      </div>
    </>
  );
}

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub: React.ReactNode }) {
  return (
    <Panel>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="tabular mt-2 text-3xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </Panel>
  );
}
