import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, ChevronDown, ChevronUp, Clock, TriangleAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLiveTables } from "@/lib/realtime";
import { settingsOf } from "@/lib/tenant";
import { antiGhostOf } from "@/lib/antighost";
import { kdsVisible, SOURCE_TAG, STATION_TAG, STATIONS, timerTone } from "@/lib/kds";
import { RoleGate } from "@/components/tf/RoleGate";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Membership } from "@/lib/tenant";

export const Route = createFileRoute("/app/kds")({
  head: () => ({ meta: [{ title: "Kitchen Display — TABLEFLOW" }, { name: "description", content: "Live kitchen ticket board." }] }),
  component: () => (
    <div className="dark min-h-screen bg-background text-foreground">
      <RoleGate area="kds">{(m) => <Kds m={m} />}</RoleGate>
    </div>
  ),
});

const COLS = [
  { status: "incoming", title: "Incoming", next: "accepted", action: "Accept Ticket", variant: "electric" },
  { status: "accepted", title: "Accepted", next: "preparing", action: "Start Prep", variant: "warning" },
  { status: "preparing", title: "Preparing", next: "ready", action: "Bump to Ready", variant: "success" },
  { status: "ready", title: "Ready", next: "served", action: "Mark Served", variant: "secondary" },
] as const;

function useNow() {
  const [n, setN] = useState(() => Date.now());
  useEffect(() => { const i = setInterval(() => setN(Date.now()), 1000); return () => clearInterval(i); }, []);
  return n;
}

function Kds({ m }: { m: Membership }) {
  const rid = m.restaurant_id;
  const qc = useQueryClient();
  const now = useNow();
  const [station, setStation] = useState<string>("all");
  const [delay, setDelay] = useState(false);
  const [showServed, setShowServed] = useState(false);
  const [eightySix, setEightySix] = useState(false);
  useEffect(() => { setDelay(localStorage.getItem(`kds-delay-${rid}`) === "1"); }, [rid]);
  function toggleDelay() {
    const v = !delay; setDelay(v); localStorage.setItem(`kds-delay-${rid}`, v ? "1" : "0");
    toast(v ? "+5m global delay on — quote guests 5 minutes longer" : "Global delay cleared");
  }

  const q = useQuery({
    queryKey: ["kds", rid],
    queryFn: async () => {
      const since = new Date(Date.now() - 3 * 3600000).toISOString();
      const { data, error } = await supabase.from("orders")
        .select("*, tables(table_number, capacity), order_items(*), reservations(pre_order_paid_amount, is_proximity_verified, customer_name, party_size, dietary_notes)")
        .eq("restaurant_id", rid).in("status", ["incoming", "accepted", "preparing", "ready", "served"]).gte("created_at", since)
        .or(`scheduled_fire_at.is.null,scheduled_fire_at.lte.${new Date().toISOString()}`).order("created_at");
      if (error) throw error;
      const gpsHold = antiGhostOf(settingsOf(m.restaurants)).gps_hold;
      return data.filter((o) => kdsVisible({ ...o, reservations: o.reservations as never }, gpsHold));
    },
  });
  useLiveTables(rid, ["orders", "order_items"], [["kds", rid]]);
  useEffect(() => { const i = setInterval(() => qc.invalidateQueries({ queryKey: ["kds", rid] }), 30000); return () => clearInterval(i); }, [qc, rid]);

  const orders = useMemo(() => (q.data ?? [])
    .map((o) => ({ ...o, items: station === "all" ? o.order_items : o.order_items.filter((i) => i.station === station) }))
    .filter((o) => o.items.length > 0), [q.data, station]);
  const active = orders.filter((o) => o.status !== "served");
  const served = orders.filter((o) => o.status === "served").reverse().slice(0, 20);
  const activeItems = active.reduce((n, o) => n + o.items.length, 0);
  const load = Math.min(100, Math.round((activeItems / 30) * 100));

  async function move(id: string, status: string) {
    const { error } = await supabase.from("orders").update({ status: status as never }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (status === "preparing" || status === "ready" || status === "served")
      await supabase.from("order_items").update({ item_status: status as never }).eq("order_id", id);
    if (status === "ready") toast.success("Bumped — front of house notified");
    qc.invalidateQueries({ queryKey: ["kds", rid] });
  }
  async function toggleItem(id: string, done: boolean) {
    const { error } = await supabase.from("order_items").update({ item_status: done ? "ready" : "preparing" }).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["kds", rid] });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b bg-navy px-5 py-3">
        <div className="text-lg font-bold tracking-tight">KDS <span className="ml-1 font-normal text-muted-foreground">{m.restaurants.name}</span></div>
        <nav className="flex flex-wrap gap-1 rounded-lg bg-card p-1">
          {["all", ...STATIONS].map((s) => (
            <button key={s} onClick={() => setStation(s)} className={`h-11 rounded-md px-4 text-base font-semibold ${station === s ? "bg-electric text-electric-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {s === "all" ? "All Stations" : s}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <div className="rounded-lg bg-card px-3 py-2 text-sm">
            Load <span className={`tabular text-lg font-bold ${load >= 75 ? "text-destructive" : load >= 45 ? "text-warning" : "text-success"}`}>{load}%</span>
            <span className="ml-2 text-muted-foreground">{active.length} tickets</span>
          </div>
          <Button size="lg" variant={delay ? "warning" : "secondary"} onClick={toggleDelay}><Clock />+5m Global Delay</Button>
          <Button size="lg" variant="destructive" onClick={() => setEightySix(true)}><Ban />86'd</Button>
          <span className="tabular text-xl font-bold">{new Date(now).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}</span>
          {m.role !== "kitchen" && <Button asChild size="lg" variant="secondary"><Link to="/app/owner">Exit</Link></Button>}
        </div>
      </header>
      {delay && <div className="bg-warning px-5 py-2 text-center text-base font-bold text-warning-foreground">Kitchen running +5 min behind — all quoted times extended</div>}

      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {COLS.map((c) => {
          const list = active.filter((o) => o.status === c.status);
          return (
            <section key={c.status} className="flex w-[320px] shrink-0 flex-col gap-3">
              <h2 className="flex items-center justify-between text-base font-bold uppercase tracking-wider text-muted-foreground">
                {c.title}<span className="tabular rounded bg-card px-2 text-foreground">{list.length}</span>
              </h2>
              {list.map((o) => <Ticket key={o.id} o={o} now={now} delay={delay} col={c} onMove={move} onItem={toggleItem} />)}
              {!list.length && <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">No tickets</div>}
            </section>
          );
        })}
      </div>

      <div className="border-t bg-navy">
        <button onClick={() => setShowServed((v) => !v)} className="flex h-12 w-full items-center justify-center gap-2 text-base font-semibold">
          {showServed ? <ChevronDown /> : <ChevronUp />} Served ({served.length})
        </button>
        {showServed && (
          <div className="flex gap-3 overflow-x-auto px-4 pb-4">
            {served.map((o) => (
              <div key={o.id} className="w-56 shrink-0 rounded-lg bg-card p-3">
                <div className="tabular font-bold">#{o.order_number} · {(o.tables as { table_number: string } | null)?.table_number ?? "Pre-Order"}</div>
                <div className="text-sm text-muted-foreground">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</div>
                <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={() => move(o.id, "ready")}>Recall</Button>
              </div>
            ))}
            {!served.length && <p className="p-2 text-muted-foreground">Nothing served yet.</p>}
          </div>
        )}
      </div>
      <EightySix open={eightySix} onOpenChange={setEightySix} rid={rid} />
    </div>
  );
}


function Ticket({ o, now, delay, col, onMove, onItem }: {
  o: { id: string; order_number: number; order_type: string; created_at: string; customer_notes: string | null; tables: unknown; reservations: unknown; items: { id: string; name: string; quantity: number; station: string; item_status: string; special_instructions: string | null; modifiers_selected_json: unknown }[] };
  now: number; delay: boolean; col: (typeof COLS)[number];
  onMove: (id: string, s: string) => void; onItem: (id: string, done: boolean) => void;
}) {
  const ms = now - new Date(o.created_at).getTime();
  const mins = Math.floor(ms / 60000), secs = Math.floor(ms / 1000) % 60;
  const tone = timerTone(mins);
  const head = tone === "red" ? "bg-destructive text-destructive-foreground animate-flash" : tone === "amber" ? "bg-warning text-warning-foreground" : "bg-muted text-foreground";
  const table = o.tables as { table_number: string; capacity: number } | null;
  const res = o.reservations as { customer_name: string; party_size: number; dietary_notes: string | null } | null;
  const alerts = [res?.dietary_notes, ...o.items.map((i) => i.special_instructions)].filter(Boolean) as string[];
  const guests = res?.party_size ?? table?.capacity;
  return (
    <article className="overflow-hidden rounded-xl bg-card shadow-card">
      <div className={`flex items-center justify-between px-4 py-3 ${head}`}>
        <span className="tabular text-xl font-bold">#{o.order_number} • {table ? `Table ${table.table_number}` : "ETA Pre-Order"}</span>
        <span className="tabular text-xl font-bold">{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}</span>
      </div>
      <div className="flex items-center gap-2 px-4 pt-3 text-base">
        <span className="rounded bg-electric px-2 py-0.5 text-sm font-bold text-electric-foreground">{SOURCE_TAG[o.order_type] ?? o.order_type}</span>
        {guests && <span className="flex items-center gap-1 text-muted-foreground"><Users className="h-4 w-4" />{guests}</span>}
        {res && <span className="truncate text-muted-foreground">{res.customer_name}</span>}
        {delay && <span className="ml-auto text-sm font-bold text-warning">+5m</span>}
      </div>
      {alerts.length > 0 && (
        <div className="mx-4 mt-3 rounded-lg bg-destructive px-3 py-2 text-destructive-foreground">
          <div className="flex items-center gap-1 text-sm font-black"><TriangleAlert className="h-4 w-4" />ALLERGY / DIETARY ALERT</div>
          {alerts.map((a, i) => <div key={i} className="text-base font-semibold">{a}</div>)}
        </div>
      )}
      <ul className="space-y-2 px-4 py-3">
        {o.items.map((i) => {
          const done = i.item_status === "ready" || i.item_status === "served";
          const mods = Array.isArray(i.modifiers_selected_json) ? (i.modifiers_selected_json as unknown[]).map((x) => typeof x === "string" ? x : (x as { name?: string })?.name).filter(Boolean) : [];
          return (
            <li key={i.id}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <Checkbox className="mt-1 h-6 w-6" checked={done} onCheckedChange={(v) => onItem(i.id, v === true)} />
                <span className={`flex-1 text-lg font-bold leading-snug ${done ? "text-muted-foreground line-through" : ""}`}>
                  <span className="tabular">{i.quantity}×</span> {i.name}
                  {mods.length > 0 && <span className="block text-sm font-medium text-muted-foreground">+ {mods.join(", ")}</span>}
                </span>
                <span className="rounded border px-1.5 text-xs font-bold text-muted-foreground">{STATION_TAG[i.station] ?? i.station}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {o.customer_notes && <p className="mx-4 mb-3 rounded bg-muted p-2 text-base">{o.customer_notes}</p>}
      <Button className="h-[52px] w-full rounded-none text-lg font-bold" variant={col.variant} onClick={() => onMove(o.id, col.next)}>{col.action}</Button>
    </article>
  );
}

function EightySix({ open, onOpenChange, rid }: { open: boolean; onOpenChange: (v: boolean) => void; rid: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["86", rid], enabled: open,
    queryFn: async () => (await supabase.from("menu_items").select("id,name,station,is_available").eq("restaurant_id", rid).order("name")).data ?? [],
  });
  async function toggle(id: string, available: boolean) {
    const { error } = await supabase.from("menu_items").update({ is_available: available }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast(available ? "Back on the menu" : "86'd — removed from guest menu and POS");
    qc.invalidateQueries({ queryKey: ["86", rid] });
  }
  const list = (q.data ?? []).filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark max-w-lg bg-card text-foreground">
        <DialogHeader><DialogTitle className="text-xl">Out of Stock (86'd)</DialogTitle></DialogHeader>
        <Input placeholder="Search dishes…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-12 text-base" />
        <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
          {list.map((i) => (
            <li key={i.id} className={`flex min-h-14 items-center justify-between rounded-lg px-3 ${i.is_available ? "" : "bg-destructive/20"}`}>
              <div><div className={`text-lg font-semibold ${i.is_available ? "" : "line-through"}`}>{i.name}</div><div className="text-xs text-muted-foreground">{i.station}</div></div>
              <div className="flex items-center gap-2 text-sm">{i.is_available ? "Available" : "86'd"}<Switch checked={i.is_available} onCheckedChange={(v) => toggle(i.id, v)} /></div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
