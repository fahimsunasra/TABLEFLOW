import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Combine, Pencil, Plus, Split } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money, useMembership, type Row } from "@/lib/tenant";
import { useLiveTables } from "@/lib/realtime";
import { ymd } from "@/lib/date-range";
import { label, TABLE_STATUS_CLASS, TABLE_STATUSES } from "@/lib/status";
import { PageHeader, Panel, Pill } from "@/components/tf/Ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/app/owner/floor")({ component: Floor });

type T = Row<"tables">;
const ZONES = ["All Zones", "Main Dining", "Patio", "Bar"] as const;
const LEGEND: [string, string][] = [["available", "Available"], ["reserved", "Reserved"], ["occupied", "Occupied"], ["waiting_food", "Waiting for Food"], ["bill_requested", "Bill Requested"], ["cleaning", "Cleaning"]];

/** Table footprint in px from shape and seats (2, 4, 6, 8+). */
export function tableSize(shape: T["shape"], capacity: number) {
  const base = capacity <= 2 ? 72 : capacity <= 4 ? 96 : capacity <= 6 ? 112 : 128;
  if (shape === "rectangle") return { w: base + 56, h: Math.round(base * 0.7) };
  return { w: base, h: base };
}

/** Older layouts stored grid cells (1, 2, 3…); render those on a 170×150px grid. */
const px = (t: T) => (t.pos_x < 20 && t.pos_y < 20 ? { x: 40 + Math.max(0, t.pos_x - 1) * 170, y: 40 + Math.max(0, t.pos_y - 1) * 150 } : { x: t.pos_x, y: t.pos_y });

function useNow(ms = 30000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setN(Date.now()), ms); return () => clearInterval(i); }, [ms]);
  return n;
}

function Floor() {
  const { data: m } = useMembership();
  const rid = m!.restaurant_id;
  const qc = useQueryClient();
  const now = useNow();
  const [zone, setZone] = useState<(typeof ZONES)[number]>("All Zones");
  const [edit, setEdit] = useState(false);
  const [merging, setMerging] = useState<string[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; x: number; y: number } | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const today = ymd(new Date());

  const q = useQuery({
    queryKey: ["floor", rid],
    queryFn: async () => {
      const [t, r] = await Promise.all([
        supabase.from("tables").select("*").eq("restaurant_id", rid).order("table_number"),
        supabase.from("reservations").select("id,table_id,customer_name,party_size,arrival_time,eta_time,status").eq("restaurant_id", rid).eq("booking_date", today).in("status", ["pending", "confirmed", "arriving_soon", "checked_in", "seated"]),
      ]);
      return { tables: t.data ?? [], res: r.data ?? [] };
    },
  });
  useLiveTables(rid, ["tables", "reservations", "orders"], [["floor", rid]]);
  const tables = q.data?.tables ?? [];
  const shown = tables.filter((t) => zone === "All Zones" || t.zone === zone);
  const byId = new Map(tables.map((t) => [t.id, t]));
  const refresh = () => qc.invalidateQueries({ queryKey: ["floor", rid] });

  function onDown(e: React.PointerEvent, t: T) {
    if (merging) { setMerging(merging.includes(t.id) ? merging.filter((x) => x !== t.id) : [...merging, t.id]); return; }
    if (!edit) { setOpenId(t.id); return; }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p0 = px(t);
    setDrag({ id: t.id, dx: e.clientX - p0.x, dy: e.clientY - p0.y, x: p0.x, y: p0.y });
  }
  function onMove(e: React.PointerEvent) {
    if (!drag) return;
    const snap = (v: number) => Math.max(0, Math.round(v / 10) * 10);
    setDrag({ ...drag, x: snap(e.clientX - drag.dx), y: snap(e.clientY - drag.dy) });
  }
  async function onUp() {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    qc.setQueryData(["floor", rid], (old: typeof q.data) => old && { ...old, tables: old.tables.map((t) => (t.id === d.id ? { ...t, pos_x: d.x, pos_y: d.y } : t)) });
    const { error } = await supabase.from("tables").update({ pos_x: d.x, pos_y: d.y }).eq("id", d.id);
    if (error) { toast.error(error.message); refresh(); }
  }
  async function doMerge() {
    if (!merging || merging.length < 2) { toast.error("Pick at least two tables"); return; }
    const [primary, ...rest] = merging;
    const { error } = await supabase.from("tables").update({ merged_into: primary! }).in("id", rest);
    if (error) toast.error(error.message); else toast.success(`Merged into ${byId.get(primary!)?.table_number}`);
    setMerging(null);
    refresh();
  }

  const open = openId ? byId.get(openId) : undefined;
  const maxX = Math.max(900, ...shown.map((t) => px(t).x + 200));
  const maxY = Math.max(560, ...shown.map((t) => px(t).y + 180));

  return (
    <>
      <PageHeader title="Floor Management" sub="Live table status across every zone" action={
        <div className="flex flex-wrap items-center gap-2">
          {edit && !merging && <>
            <Button variant="outline" onClick={() => setMerging([])}><Combine />Merge Tables</Button>
            <Button variant="outline" onClick={() => setAdding(true)}><Plus />Add Table</Button>
          </>}
          {merging && <>
            <span className="text-sm text-muted-foreground">Select tables — first one becomes the main table ({merging.length})</span>
            <Button variant="ghost" onClick={() => setMerging(null)}>Cancel</Button>
            <Button variant="electric" onClick={doMerge}>Merge {merging.length}</Button>
          </>}
          <label className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm"><Pencil className="h-4 w-4" />Edit Layout<Switch checked={edit} onCheckedChange={(v) => { setEdit(v); setMerging(null); }} /></label>
        </div>
      } />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {ZONES.map((z) => (
            <button key={z} onClick={() => setZone(z)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${zone === z ? "bg-card shadow-card" : "text-muted-foreground"}`}>
              {z} <span className="tabular ml-1 text-xs opacity-60">{z === "All Zones" ? tables.length : tables.filter((t) => t.zone === z).length}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-3 text-xs">
          {LEGEND.map(([s, l]) => <span key={s} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded border ${TABLE_STATUS_CLASS[s]}`} />{l}</span>)}
        </div>
      </div>

      <Panel className="overflow-auto p-0">
        <div ref={canvas} onPointerMove={onMove} onPointerUp={onUp}
          className={`relative ${edit ? "bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-[length:20px_20px]" : ""}`}
          style={{ width: maxX, height: maxY }}>
          {shown.map((t) => {
            const pos = drag?.id === t.id ? { x: drag.x, y: drag.y } : px(t);
            const { w, h } = tableSize(t.shape, t.capacity);
            const res = q.data?.res.find((r) => r.table_id === t.id && r.status !== "seated");
            const parent = t.merged_into ? byId.get(t.merged_into) : undefined;
            const mins = Math.floor((now - new Date(t.status_changed_at).getTime()) / 60000);
            const selected = merging?.includes(t.id);
            return (
              <button key={t.id} onPointerDown={(e) => onDown(e, t)} style={{ left: pos.x, top: pos.y, width: w, height: h, touchAction: "none" }}
                className={`absolute flex select-none flex-col items-center justify-center border-2 text-center shadow-card transition-shadow ${t.shape === "round" ? "rounded-full" : "rounded-2xl"} ${TABLE_STATUS_CLASS[t.status]} ${edit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer hover:shadow-glow"} ${selected ? "ring-4 ring-electric" : ""} ${parent ? "border-dashed" : ""}`}>
                <span className="tabular text-sm font-bold">{t.table_number}</span>
                <span className="text-[10px] opacity-80">{t.capacity >= 8 ? "8+" : t.capacity} seats</span>
                {t.status === "occupied" && <span className="tabular text-[10px] font-semibold">{mins}m</span>}
                {t.status === "waiting_food" && <span className="tabular text-[10px] font-semibold">food {mins}m</span>}
                {parent && <span className="text-[10px]">↳ {parent.table_number}</span>}
                {res && t.status === "reserved" && (
                  <span className="tabular absolute -top-2.5 rounded-full bg-electric px-2 py-0.5 text-[10px] font-semibold text-electric-foreground">
                    ETA {res.eta_time ? new Date(res.eta_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false }) : res.arrival_time.slice(0, 5)}
                  </span>
                )}
              </button>
            );
          })}
          {!shown.length && <p className="p-10 text-sm text-muted-foreground">No tables in this zone yet.</p>}
        </div>
      </Panel>

      <AddTable open={adding} onOpenChange={setAdding} rid={rid} next={`T-${String(tables.length + 1).padStart(2, "0")}`} defaultZone={zone === "All Zones" ? "Main Dining" : zone} onDone={refresh} />
      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {open && <TableDrawer t={open} all={tables} cur={m!.restaurants.currency} onChange={refresh} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function AddTable({ open, onOpenChange, rid, next, defaultZone, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; rid: string; next: string; defaultZone: T["zone"]; onDone: () => void }) {
  const [f, setF] = useState({ table_number: next, zone: defaultZone, capacity: 4, shape: "square" as T["shape"] });
  useEffect(() => { if (open) setF({ table_number: next, zone: defaultZone, capacity: 4, shape: "square" }); }, [open, next, defaultZone]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("tables").insert({ ...f, restaurant_id: rid, pos_x: 40, pos_y: 40 });
    if (error) { toast.error(error.message); return; }
    toast.success(`${f.table_number} added — drag it into place`);
    onOpenChange(false);
    onDone();
  }
  const sel = "h-9 w-full rounded-md border bg-background px-3 text-sm";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Table</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Table number</Label><Input required value={f.table_number} onChange={(e) => setF({ ...f, table_number: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Zone</Label><select className={sel} value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value as T["zone"] })}>{ZONES.slice(1).map((z) => <option key={z}>{z}</option>)}</select></div>
          <div className="space-y-1.5"><Label>Seats</Label><select className={sel} value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })}>{[2, 4, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
          <div className="space-y-1.5"><Label>Shape</Label><select className={sel} value={f.shape} onChange={(e) => setF({ ...f, shape: e.target.value as T["shape"] })}>{["square", "round", "rectangle"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div>
          <DialogFooter className="sm:col-span-2"><Button type="submit" variant="electric">Add table</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TableDrawer({ t, all, cur, onChange }: { t: T; all: T[]; cur: string; onChange: () => void }) {
  const q = useQuery({
    queryKey: ["table-detail", t.id],
    queryFn: async () => {
      const [r, o] = await Promise.all([
        supabase.from("reservations").select("*").eq("table_id", t.id).eq("booking_date", ymd(new Date())).not("status", "in", "(completed,cancelled,no_show)").order("arrival_time").limit(1).maybeSingle(),
        supabase.from("orders").select("id,order_number,status,payment_status,total_amount,order_items(id,name,quantity,item_status,special_instructions)").eq("table_id", t.id).not("status", "in", "(served,cancelled)").order("created_at"),
      ]);
      const res = r.data;
      let cust = null;
      if (res && (res.customer_phone || res.customer_email)) {
        const filters = [res.customer_phone && `phone.eq.${res.customer_phone}`, res.customer_email && `email.eq.${res.customer_email}`].filter(Boolean).join(",");
        cust = (await supabase.from("customers").select("*").eq("restaurant_id", t.restaurant_id).or(filters).limit(1).maybeSingle()).data;
      }
      return { res, orders: o.data ?? [], cust };
    },
  });
  useLiveTables(t.restaurant_id, ["orders", "order_items", "reservations"], [["table-detail", t.id]]);
  const children = all.filter((x) => x.merged_into === t.id);
  const parent = all.find((x) => x.id === t.merged_into);

  async function setStatus(status: T["status"]) {
    const { error } = await supabase.from("tables").update({ status }).eq("id", t.id);
    if (error) toast.error(error.message); else onChange();
  }
  async function split() {
    const ids = parent ? [t.id] : children.map((c) => c.id);
    const { error } = await supabase.from("tables").update({ merged_into: null }).in("id", ids);
    if (error) toast.error(error.message); else { toast.success("Tables split"); onChange(); }
  }
  const d = q.data;
  const unpaid = d?.orders.reduce((s, o) => s + (o.payment_status === "paid" ? 0 : Number(o.total_amount)), 0) ?? 0;
  const allergies = [d?.res?.dietary_notes, d?.cust?.notes, ...(d?.cust?.tags_array.filter((x) => /allerg|free|vegan|vegetarian/i.test(x)) ?? [])].filter(Boolean);

  return (
    <>
      <SheetHeader><SheetTitle className="flex items-center gap-2"><span className="tabular">{t.table_number}</span><Pill className={TABLE_STATUS_CLASS[t.status] ?? ""}>{label(t.status)}</Pill></SheetTitle></SheetHeader>
      <p className="mt-1 text-sm text-muted-foreground">{t.zone} · {t.capacity} seats · {label(t.shape)}{parent && ` · merged into ${parent.table_number}`}{children.length > 0 && ` · joined with ${children.map((c) => c.table_number).join(", ")}`}</p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {TABLE_STATUSES.map((s) => <Button key={s} variant={s === t.status ? "electric" : "outline"} size="sm" onClick={() => setStatus(s as T["status"])}>{label(s)}</Button>)}
      </div>
      {(parent || children.length > 0) && <Button variant="outline" className="mt-2 w-full" onClick={split}><Split />Split Table</Button>}

      <Section title="Assigned reservation">
        {d?.res ? (
          <div className="text-sm">
            <div className="font-medium">{d.res.customer_name} · {d.res.party_size} guests</div>
            <div className="tabular text-muted-foreground">{d.res.arrival_time.slice(0, 5)}{d.res.eta_time && ` · ETA ${new Date(d.res.eta_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })}`} · {label(d.res.status)}</div>
            {d.res.special_requests && <div className="mt-1 text-xs">{d.res.special_requests}</div>}
          </div>
        ) : <Empty>No booking assigned today.</Empty>}
      </Section>

      <Section title="Customer profile">
        {d?.cust ? (
          <div className="text-sm">
            <div className="flex justify-between"><span className="font-medium">{d.cust.full_name}</span><Pill>{d.cust.loyalty_tier}</Pill></div>
            <div className="tabular mt-1 text-xs text-muted-foreground">{d.cust.total_visits} visits · {money(d.cust.lifetime_spend, cur)} lifetime · {d.cust.loyalty_points} pts</div>
          </div>
        ) : <Empty>No matching guest profile.</Empty>}
        {allergies.length > 0 && <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">⚠ {allergies.join(" · ")}</div>}
      </Section>

      <Section title="Active order items">
        {d?.orders.length ? d.orders.map((o) => (
          <div key={o.id} className="mb-3">
            <div className="flex justify-between text-sm"><span className="tabular font-semibold">#{o.order_number}</span><Pill>{label(o.status)}</Pill></div>
            <ul className="mt-1 space-y-0.5 text-sm">
              {o.order_items.map((i) => <li key={i.id} className="flex justify-between"><span><span className="tabular">{i.quantity}×</span> {i.name}</span><span className="text-xs text-muted-foreground">{label(i.item_status)}</span></li>)}
            </ul>
          </div>
        )) : <Empty>No active orders.</Empty>}
      </Section>

      <Section title="Payment">
        <div className="flex justify-between text-sm"><span>Outstanding</span><span className="tabular font-bold">{money(unpaid, cur)}</span></div>
        <div className="mt-1 text-xs text-muted-foreground">{d?.orders.length ? d.orders.map((o) => `#${o.order_number}: ${label(o.payment_status)}`).join(" · ") : "Nothing to pay"}</div>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mt-5 rounded-xl border p-4"><div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) { return <p className="text-sm text-muted-foreground">{children}</p>; }
