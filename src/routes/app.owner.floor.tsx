import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Merge, Plus, Table2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money, useMembership, type Membership, type Row } from "@/lib/tenant";
import { useLiveTables } from "@/lib/realtime";
import { label, TABLE_STATUS_CLASS } from "@/lib/status";
import { PageHeader, Pill } from "@/components/tf/Ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/app/owner/floor")({ component: Floor });

type Table = Row<"tables">;
type Res = Row<"reservations">;
type ZONE = "Main Dining" | "Patio" | "Bar";
const ZONES: (ZONE | "All Zones")[] = ["All Zones", "Main Dining", "Patio", "Bar"];
const CELL = 116; // px per grid cell — canvas is a 4-column grid

function Floor() {
  const { data: m } = useMembership();
  const rid = m!.restaurant_id;
  const cur = m!.restaurants.currency;
  const qc = useQueryClient();
  const [zone, setZone] = useState<ZONE | "All Zones">("All Zones");
  const [editing, setEditing] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [merging, setMerging] = useState(false);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const tablesQ = useQuery({
    queryKey: ["floor-tables", rid],
    queryFn: async () => (await supabase.from("tables").select("*").eq("restaurant_id", rid).order("table_number")).data ?? [],
  });
  const resQ = useQuery({
    queryKey: ["floor-res", rid],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      return (await supabase.from("reservations").select("*").eq("restaurant_id", rid).eq("booking_date", today)
        .not("status", "in", "(completed,cancelled,no_show)").order("arrival_time")).data ?? [];
    },
  });
  const ordersQ = useQuery({
    queryKey: ["floor-orders", rid],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, order_items(name,quantity,item_status)").eq("restaurant_id", rid)
        .in("status", ["incoming", "accepted", "preparing", "ready"]).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  useLiveTables(rid, ["tables", "reservations", "orders"], [["floor-tables", rid], ["floor-res", rid], ["floor-orders", rid]]);

  const tables = tablesQ.data ?? [];
  const reservations = resQ.data ?? [];
  const orders = ordersQ.data ?? [];
  const shown = zone === "All Zones" ? tables : tables.filter((t) => t.zone === zone);
  const selected = tables.find((t) => t.id === sel) ?? null;
  const resFor = (id: string | null) => reservations.find((r) => r.table_id === id);
  const orderFor = (id: string | null) => orders.find((o) => o.table_id === id);

  const maxX = Math.max(3, ...tables.map((t) => t.pos_x));
  const maxY = Math.max(3, ...tables.map((t) => t.pos_y));

  async function persistPos(id: string, pos_x: number, pos_y: number) {
    const { error } = await supabase.from("tables").update({ pos_x: Math.max(0, pos_x), pos_y: Math.max(0, pos_y) }).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["floor-tables", rid] });
  }

  function onPointerDown(e: React.PointerEvent, t: Table) {
    if (!editing) { setSel(t.id); return; }
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cellW = rect.width / (maxX + 1);
    const cellH = CELL;
    setDrag({ id: t.id, dx: (e.clientX - rect.left) - t.pos_x * cellW, dy: (e.clientY - rect.top) - t.pos_y * cellH });
    setSel(t.id);
    const move = (ev: PointerEvent) => {
      const r2 = canvasRef.current?.getBoundingClientRect();
      if (!r2) return;
      const nx = Math.round(((ev.clientX - r2.left) - dragRef.current!.dx) / (r2.width / (maxX + 1)));
      const ny = Math.round(((ev.clientY - r2.top) - dragRef.current!.dy) / CELL);
      setPos({ id: t.id, x: Math.max(0, Math.min(nx, maxX)), y: Math.max(0, Math.min(ny, maxY + 2)) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const r2 = canvasRef.current?.getBoundingClientRect();
      if (r2) {
        const nx = Math.max(0, Math.min(Math.round(((ev.clientX - r2.left) - dragRef.current!.dx) / (r2.width / (maxX + 1))), maxX));
        const ny = Math.max(0, Math.min(Math.round(((ev.clientY - r2.top) - dragRef.current!.dy) / CELL), maxY + 2));
        void persistPos(t.id, nx, ny);
      }
      setDrag(null);
    };
    dragRef.current = { dx: drag.dx, dy: drag.dy };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const [, setPos] = useState<{ id: string; x: number; y: number } | null>(null);

  return (
    <>
      <PageHeader
        title="Floor Management"
        sub="Live tables, zones and layout"
        action={
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium"><Table2 className="h-4 w-4" />Edit Floor Layout<Switch checked={editing} onCheckedChange={setEditing} /></label>
            {editing && <Button variant="electric" onClick={() => setAdding(true)}><Plus />Add Table</Button>}
            {editing && <Button variant="outline" onClick={() => setMerging(true)}><Merge />Merge / Split</Button>}
          </div>
        }
      />
      <div className="flex flex-wrap gap-2">
        {ZONES.map((z) => (
          <button key={z} onClick={() => setZone(z)} className={`rounded-full border px-3 py-1 text-xs font-medium ${zone === z ? "border-navy bg-navy text-primary-foreground" : "bg-card hover:border-electric/40"}`}>{z}</button>
        ))}
      </div>

      <div ref={canvasRef} className="relative mt-4 rounded-2xl border bg-muted/30 p-4" style={{ minHeight: (maxY + 1) * CELL + 32 }}>
        <div className="grid grid-cols-4 gap-4">
          {shown.map((t) => {
            const r = resFor(t.id);
            const style: React.CSSProperties = editing ? { gridColumn: t.pos_x + 1, gridRow: t.pos_y + 1 } : {};
            return (
              <button
                key={t.id}
                data-table={t.id}
                onPointerDown={(e) => onPointerDown(e, t)}
                style={style}
                className={`relative min-h-28 border-2 p-3 text-left transition-[border,box-shadow] ${t.shape === "round" ? "rounded-full" : "rounded-2xl"} ${TABLE_STATUS_CLASS[t.status]} ${sel === t.id ? "ring-4 ring-electric" : ""} ${editing ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
              >
                {t.status === "occupied" && <span className="absolute inset-x-0 top-0 h-1.5 rounded-t bg-warning" />}
                <div className="tabular text-lg font-bold">{t.table_number}</div>
                <div className="text-xs">{t.capacity} seats · {label(t.shape)}</div>
                {t.status === "reserved" && r && <div className="mt-1 truncate rounded bg-electric/20 px-1.5 py-0.5 text-[11px] font-medium text-electric">{r.customer_name} · {r.arrival_time.slice(0, 5)}</div>}
                {t.status === "bill_requested" && <div className="mt-1 animate-pulse rounded bg-electric/20 px-1.5 py-0.5 text-[11px] font-semibold text-electric">Bill requested</div>}
                {t.status === "cleaning" && (
                  <span className="absolute inset-0 rounded-2xl bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(0,0,0,0.06)_8px,rgba(0,0,0,0.06)_16px)]" onClick={(e) => e.stopPropagation()} />
                )}
              </button>
            );
          })}
        </div>
        {!shown.length && <p className="grid place-items-center py-16 text-sm text-muted-foreground">No tables in this zone yet.</p>}
      </div>

      <Sheet open={!!selected && !editing} onOpenChange={(v) => !v && setSel(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && <TableDrawer t={selected} res={resFor(selected.id)} order={orderFor(selected.id)} cur={cur} rid={rid} onDone={() => { qc.invalidateQueries({ queryKey: ["floor-tables", rid] }); qc.invalidateQueries({ queryKey: ["floor-res", rid] }); }} onClose={() => setSel(null)} />}
        </SheetContent>
      </Sheet>

      <AddTableDialog open={adding} onOpenChange={setAdding} rid={rid} onDone={() => qc.invalidateQueries({ queryKey: ["floor-tables", rid] })} nextNumber={`T-${String(tables.length + 1).padStart(2, "0")}`} />
      <MergeDialog open={merging} onOpenChange={setMerging} tables={tables} rid={rid} onDone={() => qc.invalidateQueries({ queryKey: ["floor-tables", rid] })} />
    </>
  );
}

function TableDrawer({ t, res, order, cur, rid, onDone, onClose }: { t: Table; res: Res | undefined; order: { id: string; order_number: number; payment_status: string; total_amount: number; order_items: { name: string; quantity: number; item_status: string }[] } | undefined; cur: string; rid: string; onDone: () => void; onClose: () => void }) {
  async function setStatus(status: Table["status"]) {
    const { error } = await supabase.from("tables").update({ status }).eq("id", t.id);
    if (error) toast.error(error.message);
    else { toast.success(`${t.table_number} marked ${label(status).toLowerCase()}`); onDone(); if (status === "available") onClose(); }
  }
  return (
    <>
      <SheetHeader><SheetTitle>Table {t.table_number} — {t.zone}</SheetTitle></SheetHeader>
      <div className="mt-4 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Pill className={TABLE_STATUS_CLASS[t.status]}>{label(t.status)}</Pill>
          <span className="text-xs text-muted-foreground">{t.capacity} seats · {label(t.shape)}</span>
        </div>

        <div className="rounded-xl border p-4">
          <h3 className="mb-2 text-sm font-semibold">Assigned reservation</h3>
          {res ? (
            <div className="space-y-1 text-sm">
              <div className="font-medium">{res.customer_name} · {res.party_size} guests</div>
              <div className="text-muted-foreground">{res.customer_phone} · arrives {res.arrival_time.slice(0, 5)}</div>
              {res.dietary_notes && <div className="rounded bg-warning/10 px-2 py-1 text-xs text-warning-foreground">Allergy / dietary: {res.dietary_notes}</div>}
              {res.special_requests && <div className="text-xs text-muted-foreground">Requests: {res.special_requests}</div>}
              <div className="flex flex-wrap gap-1 pt-1">
                {res.pre_order_paid_amount > 0 && <Pill className="border-success/40 text-success">Deposit {money(res.pre_order_paid_amount, cur)}</Pill>}
                {res.is_proximity_verified && <Pill className="border-electric/40 text-electric">GPS verified</Pill>}
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground">No reservation assigned.</p>}
        </div>

        <div className="rounded-xl border p-4">
          <h3 className="mb-2 text-sm font-semibold">Active order</h3>
          {order ? (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="tabular font-medium">#{order.order_number}</span><span className="tabular">{money(order.total_amount, cur)}</span></div>
              <ul className="text-xs text-muted-foreground">{order.order_items.map((i, ix) => <li key={ix}>{i.quantity}× {i.name} — {label(i.item_status)}</li>)}</ul>
              <div className="pt-1 text-xs">Payment: <Pill className={order.payment_status === "paid" ? "border-success/40 text-success" : "border-warning/50 text-warning-foreground"}>{label(order.payment_status)}</Pill></div>
            </div>
          ) : <p className="text-sm text-muted-foreground">No open order on this table.</p>}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Quick status</h3>
          <div className="grid grid-cols-2 gap-2">
            {(["available", "occupied", "bill_requested", "cleaning"] as const).map((s) => (
              <Button key={s} variant={t.status === s ? "electric" : "outline"} onClick={() => setStatus(s)}>{s === "cleaning" ? "Mark Clean" : label(s)}</Button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function AddTableDialog({ open, onOpenChange, rid, onDone, nextNumber }: { open: boolean; onOpenChange: (v: boolean) => void; rid: string; onDone: () => void; nextNumber: string }) {
  const [f, setF] = useState({ number: nextNumber, capacity: "4", zone: "Main Dining" as ZONE, shape: "square" as Table["shape"] });
  useEffect(() => { if (open) setF((v) => ({ ...v, number: nextNumber })); }, [open, nextNumber]);
  async function submit() {
    const { error } = await supabase.from("tables").insert({
      restaurant_id: rid, table_number: f.number.trim(), capacity: Math.max(1, Number(f.capacity) || 2),
      zone: f.zone, shape: f.shape, pos_x: 0, pos_y: 0,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Table ${f.number} added`);
    onOpenChange(false);
    onDone();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Add Table</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Table number</Label><Input value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Seats</Label><Input type="number" min={1} max={20} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Zone</Label>
            <Select value={f.zone} onValueChange={(v) => setF({ ...f, zone: v as ZONE })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(["Main Dining", "Patio", "Bar"] as const).map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Shape</Label>
            <Select value={f.shape} onValueChange={(v) => setF({ ...f, shape: v as Table["shape"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(["square", "round", "rectangle"] as const).map((s) => <SelectItem key={s} value={s}>{label(s)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="electric" onClick={submit}>Add table</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MergeDialog({ open, onOpenChange, tables, rid, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; tables: Table[]; rid: string; onDone: () => void }) {
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");
  const byId = (id: string) => tables.find((t) => t.id === id);
  async function merge() {
    if (!a || !b || a === b) { toast.error("Pick two different tables"); return; }
    const { error: e1 } = await supabase.from("tables").update({ merged_into: b }).eq("id", a);
    const { error: e2 } = await supabase.from("tables").update({ status: "occupied" }).eq("id", b);
    if (e1 || e2) { toast.error((e1 ?? e2)!.message); return; }
    toast.success(`${byId(a)?.table_number} merged into ${byId(b)?.table_number}`);
    onOpenChange(false);
    onDone();
  }
  async function split() {
    if (!a) { toast.error("Pick a merged table to split"); return; }
    const { error } = await supabase.from("tables").update({ merged_into: null }).eq("id", a);
    if (error) { toast.error(error.message); return; }
    toast.success(`${byId(a)?.table_number} split back out`);
    onOpenChange(false);
    onDone();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Merge / Split Tables</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Table A</Label>
            <Select value={a} onValueChange={setA}><SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>{tables.map((t) => <SelectItem key={t.id} value={t.id}>{t.table_number}{t.merged_into ? " (merged)" : ""}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label>Table B (merge target)</Label>
            <Select value={b} onValueChange={setB}><SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>{tables.map((t) => <SelectItem key={t.id} value={t.id}>{t.table_number}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="outline" onClick={split}>Split</Button>
          <Button variant="electric" onClick={merge}>Merge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
