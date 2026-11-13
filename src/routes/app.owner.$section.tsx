import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money, useMembership, type Membership } from "@/lib/tenant";
import { useLiveTables } from "@/lib/realtime";
import { label, TABLE_STATUS_CLASS, TABLE_STATUSES } from "@/lib/status";
import { PageHeader, Panel, Pill } from "@/components/tf/Ui";
import { Switch } from "@/components/ui/switch";
import { OWNER_SECTIONS } from "@/lib/owner-sections";

export const Route = createFileRoute("/app/owner/$section")({
  beforeLoad: ({ params }) => {
    if (!OWNER_SECTIONS.some((s) => s.slug === params.section)) throw notFound();
  },
  component: Section,
});

function Section() {
  const { section } = Route.useParams();
  const { data: m } = useMembership();
  const meta = OWNER_SECTIONS.find((s) => s.slug === section)!;
  const View = VIEWS[section];
  return (
    <>
      <PageHeader title={meta.label} sub={m!.restaurants.name} />
      {View ? <View m={m!} /> : (
        <Panel className="py-16 text-center">
          <meta.icon className="mx-auto h-8 w-8 text-electric" />
          <p className="mt-3 font-semibold">{meta.label} module</p>
          <p className="text-sm text-muted-foreground">The data foundation is ready — this workspace is next on the build list.</p>
        </Panel>
      )}
    </>
  );
}

function useRows<T>(key: string, rid: string, fn: () => PromiseLike<{ data: T[] | null; error: unknown }>) {
  return useQuery({ queryKey: [key, rid], queryFn: async () => { const { data, error } = await fn(); if (error) throw error; return data ?? []; } });
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <Panel className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-muted-foreground">
          <tr>{head.map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-4 py-3">{c}</td>)}</tr>)}
        </tbody>
      </table>
      {!rows.length && <p className="p-6 text-center text-sm text-muted-foreground">Nothing here yet.</p>}
    </Panel>
  );
}

const RES_STATUSES = ["pending", "confirmed", "arriving_soon", "checked_in", "seated", "completed", "cancelled", "no_show"] as const;

function Reservations({ m }: { m: Membership }) {
  const rid = m.restaurant_id;
  const qc = useQueryClient();
  const q = useRows("reservations", rid, () => supabase.from("reservations").select("*").eq("restaurant_id", rid).order("booking_date").order("arrival_time"));
  useLiveTables(rid, ["reservations"], [["reservations", rid]]);
  async function set(id: string, status: (typeof RES_STATUSES)[number]) {
    const { error } = await supabase.from("reservations").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["reservations", rid] });
  }
  return <Table head={["Date", "Time", "Guest", "Party", "Notes", "Status"]} rows={(q.data ?? []).map((r) => [
    <span className="tabular">{r.booking_date}</span>, <span className="tabular">{r.arrival_time.slice(0, 5)}</span>,
    <div><div className="font-medium">{r.customer_name}</div><div className="text-xs text-muted-foreground">{r.customer_phone}</div></div>,
    r.party_size, <span className="text-xs text-muted-foreground">{[r.special_requests, r.dietary_notes].filter(Boolean).join(" · ")}</span>,
    <select className="rounded-md border bg-background px-2 py-1 text-xs" value={r.status} onChange={(e) => set(r.id, e.target.value as never)}>
      {RES_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
    </select>,
  ])} />;
}

function FloorPlan({ m }: { m: Membership }) {
  const rid = m.restaurant_id;
  const qc = useQueryClient();
  const q = useRows("tables", rid, () => supabase.from("tables").select("*").eq("restaurant_id", rid).order("table_number"));
  useLiveTables(rid, ["tables"], [["tables", rid]]);
  const zones = ["Main Dining", "Patio", "Bar"] as const;
  async function set(id: string, status: string) {
    const { error } = await supabase.from("tables").update({ status: status as never }).eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["tables", rid] });
  }
  return (
    <div className="space-y-6">
      {zones.map((z) => (
        <Panel key={z}>
          <h2 className="mb-4 font-semibold">{z}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(q.data ?? []).filter((t) => t.zone === z).map((t) => (
              <div key={t.id} className={`border-2 p-3 ${t.shape === "round" ? "rounded-full aspect-square grid place-content-center text-center" : t.shape === "rectangle" ? "rounded-xl col-span-2" : "rounded-xl"} ${TABLE_STATUS_CLASS[t.status]}`}>
                <div className="tabular text-lg font-bold">{t.table_number}</div>
                <div className="text-xs">{t.capacity} seats</div>
                <select className="mt-2 w-full rounded bg-card px-1 py-0.5 text-[11px] text-foreground" value={t.status} onChange={(e) => set(t.id, e.target.value)}>
                  {TABLE_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                </select>
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}

function Orders({ m }: { m: Membership }) {
  const rid = m.restaurant_id;
  const q = useRows("orders", rid, () => supabase.from("orders").select("*, tables(table_number)").eq("restaurant_id", rid).order("created_at", { ascending: false }));
  useLiveTables(rid, ["orders"], [["orders", rid]]);
  return <Table head={["#", "Table", "Type", "Status", "Payment", "Total"]} rows={(q.data ?? []).map((o) => [
    <span className="tabular font-bold">#{o.order_number}</span>, (o.tables as { table_number: string } | null)?.table_number ?? "—",
    label(o.order_type), <Pill>{label(o.status)}</Pill>, label(o.payment_status), <span className="tabular">{money(o.total_amount, m.restaurants.currency)}</span>,
  ])} />;
}

function QrCodes({ m }: { m: Membership }) {
  const rid = m.restaurant_id;
  const q = useRows("tables", rid, () => supabase.from("tables").select("*").eq("restaurant_id", rid).order("table_number"));
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {(q.data ?? []).map((t) => {
        const url = `${origin}/guest/${m.restaurants.slug}?table=${t.table_number}`;
        return (
          <Panel key={t.id} className="text-center">
            <img alt={`QR code for ${t.table_number}`} className="mx-auto h-32 w-32" src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}`} />
            <div className="tabular mt-2 font-bold">{t.table_number}</div>
            <a href={url} target="_blank" rel="noreferrer" className="text-xs text-electric hover:underline">Open guest view</a>
          </Panel>
        );
      })}
    </div>
  );
}

function Menu({ m }: { m: Membership }) {
  const rid = m.restaurant_id;
  const qc = useQueryClient();
  const q = useRows("menu", rid, () => supabase.from("menu_items").select("*, menu_categories(name)").eq("restaurant_id", rid).order("name"));
  async function toggle(id: string, v: boolean) {
    const { error } = await supabase.from("menu_items").update({ is_available: v }).eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["menu", rid] });
  }
  return <Table head={["Item", "Category", "Station", "Prep", "Price", "Available"]} rows={(q.data ?? []).map((i) => [
    <div><div className="font-medium">{i.name}{i.is_popular && <Pill className="ml-2 border-warning/50 text-warning-foreground">Popular</Pill>}</div><div className="text-xs text-muted-foreground">{i.dietary_tags_array.join(", ")}</div></div>,
    (i.menu_categories as { name: string } | null)?.name, i.station, <span className="tabular">{i.prep_time_mins}m</span>,
    <span className="tabular">{money(i.price, m.restaurants.currency)}</span>, <Switch checked={i.is_available} onCheckedChange={(v) => toggle(i.id, v)} />,
  ])} />;
}

function Promotions({ m }: { m: Membership }) {
  const q = useRows("promos", m.restaurant_id, () => supabase.from("promotions").select("*").eq("restaurant_id", m.restaurant_id));
  return <Table head={["Title", "Code", "Type", "Value", "QR only", "Uses"]} rows={(q.data ?? []).map((p) => [
    p.title, <span className="tabular">{p.code}</span>, label(p.promo_type), <span className="tabular">{p.discount_value}</span>, p.is_qr_exclusive ? "Yes" : "No", p.usage_count,
  ])} />;
}

function Crm({ m }: { m: Membership }) {
  const q = useRows("customers", m.restaurant_id, () => supabase.from("customers").select("*").eq("restaurant_id", m.restaurant_id).order("lifetime_spend", { ascending: false }));
  return <Table head={["Guest", "Tier", "Points", "Visits", "Lifetime spend", "Tags"]} rows={(q.data ?? []).map((c) => [
    <div><div className="font-medium">{c.full_name}</div><div className="text-xs text-muted-foreground">{c.email}</div></div>, c.loyalty_tier,
    <span className="tabular">{c.loyalty_points}</span>, c.total_visits, <span className="tabular">{money(c.lifetime_spend, m.restaurants.currency)}</span>, c.tags_array.join(", "),
  ])} />;
}

function Staff({ m }: { m: Membership }) {
  const q = useRows("staff", m.restaurant_id, () => supabase.from("staff_members").select("*").eq("restaurant_id", m.restaurant_id).order("role"));
  return <Table head={["Name", "Email", "Role", "Account", "Active"]} rows={(q.data ?? []).map((s) => [
    s.full_name, s.email ?? "—", <Pill className="capitalize">{s.role}</Pill>, s.user_id ? "Linked" : "Invited", s.is_active ? "Yes" : "No",
  ])} />;
}

function SettingsView({ m }: { m: Membership }) {
  const r = m.restaurants;
  return (
    <Panel className="grid gap-4 sm:grid-cols-2">
      {[["Name", r.name], ["Guest URL", `/guest/${r.slug}`], ["Address", r.address], ["Currency", r.currency], ["Tax rate", `${r.tax_rate}%`], ["Service charge", `${r.service_charge_pct}%`]].map(([k, v]) => (
        <div key={k}><div className="text-xs text-muted-foreground">{k}</div><div className="font-medium">{v ?? "—"}</div></div>
      ))}
    </Panel>
  );
}

const VIEWS: Record<string, ((p: { m: Membership }) => React.ReactNode) | undefined> = {
  reservations: Reservations, "floor-plan": FloorPlan, orders: Orders, "qr-codes": QrCodes, menu: Menu,
  promotions: Promotions, crm: Crm, staff: Staff, settings: SettingsView,
};
