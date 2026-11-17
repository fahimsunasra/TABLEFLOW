import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Armchair, Bell, ClipboardList, CreditCard, Flame, LayoutGrid, Minus, Plus, Users, X, ArrowLeft, MapPin, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLiveTables } from "@/lib/realtime";
import { etaHold, elapsedDining, useOperationsSignals } from "@/lib/foh";
import { computeFireAt, fireModeOf } from "@/lib/preorder";
import { label, TABLE_STATUS_CLASS } from "@/lib/status";
import { money, settingsOf, type Membership, type Row } from "@/lib/tenant";
import { RoleGate } from "@/components/tf/RoleGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/app/foh")({
  head: () => ({ meta: [{ title: "Front of House — TABLEFLOW" }, { name: "description", content: "Live floor, arrivals, orders and bill service for restaurant staff." }, { property: "og:title", content: "Front of House — TABLEFLOW" }, { property: "og:description", content: "Live restaurant floor and service operations." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <RoleGate area="foh">{m => <Foh m={m} />}</RoleGate>,
});
const VIEWS = [{ id: "floor", name: "Live Floor", icon: LayoutGrid }, { id: "preorders", name: "Incoming Pre-Orders", icon: Flame }, { id: "orders", name: "Active Orders", icon: ClipboardList }, { id: "waitlist", name: "Waitlist", icon: Users }, { id: "bills", name: "Bills & Pay", icon: CreditCard }];
const ZONES = ["All Zones", "Main Dining", "Patio", "Bar"];
function Foh({ m }: { m: Membership }) {
  const rid = m.restaurant_id, cur = m.restaurants.currency;
  const qc = useQueryClient();
  const [view, setView] = useState("floor"), [zone, setZone] = useState("All Zones"), [sel, setSel] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now()), [notice, setNotice] = useState(false), [alerts, setAlerts] = useState<string[]>([]);
  const [walkin, setWalkin] = useState(false), [pos, setPos] = useState(false), [busy, setBusy] = useState(false);
  const [name, setName] = useState(""), [party, setParty] = useState(2), [walkTable, setWalkTable] = useState("");
  const [assignment, setAssignment] = useState<Record<string, string>>({}), [cart, setCart] = useState<Record<string, number>>({}), [search, setSearch] = useState(""), [notes, setNotes] = useState("");
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const onAlert = useCallback((text: string) => setAlerts(a => [text, ...a].slice(0, 30)), []);
  useOperationsSignals(rid, "foh", onAlert);
  const q = useQuery({ queryKey: ["foh", rid], queryFn: async () => {
    const day = new Date().toLocaleDateString("en-CA");
    const [t, r, o, menu, restaurant] = await Promise.all([
      supabase.from("tables").select("*").eq("restaurant_id", rid).order("table_number"),
      supabase.from("reservations").select("*").eq("restaurant_id", rid).eq("booking_date", day).order("arrival_time"),
      supabase.from("orders").select("*, order_items(*)").eq("restaurant_id", rid).or("status.in.(incoming,accepted,preparing,ready),payment_status.neq.paid").neq("status", "cancelled").order("created_at"),
      supabase.from("menu_items").select("*").eq("restaurant_id", rid).order("name"),
      supabase.from("restaurants").select("*").eq("id", rid).single(),
    ]);
    for (const result of [t,r,o,menu,restaurant]) if (result.error) throw result.error;
    return { tables: t.data ?? [], res: r.data ?? [], orders: o.data ?? [], menu: menu.data ?? [], restaurant: restaurant.data };
  }, refetchInterval: 30000 });
  useLiveTables(rid, ["tables", "reservations", "orders", "order_items"], [["foh", rid]]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["foh", rid] });
  async function run(action: () => PromiseLike<{ error: { message: string } | null }>, message: string) {
    setBusy(true); try { const result = await action(); if (result.error) throw result.error; toast.success(message); await refresh(); return true; } catch (e) { toast.error(e instanceof Error ? e.message : (e as { message?: string }).message ?? "Action failed"); return false; } finally { setBusy(false); }
  }
  const tables = (q.data?.tables ?? []).filter(t => !t.merged_into);
  const selected = tables.find(t => t.id === sel);
  const reservations = q.data?.res ?? [], orders = q.data?.orders ?? [];
  const preorders = reservations.filter(r => !["completed", "cancelled", "no_show", "seated"].includes(r.status) && orders.some(o => o.reservation_id === r.id && o.order_type === "eta_preorder"));
  const pending = preorders.filter(r => r.status === "pending").length;
  const activeRes = reservations.find(r => r.table_id === sel && !["completed", "cancelled", "no_show"].includes(r.status));
  const tableOrders = orders.filter(o => o.table_id === sel);
  const available = tables.filter(t => t.status === "available");
  const due = tableOrders.filter(o => o.payment_status !== "paid").reduce((sum, o) => sum + Number(o.total_amount), 0);
  async function changeTable(status: Row<"tables">["status"]) {
    if (!selected) return;
    await run(() => supabase.from("tables").update({ status }).eq("restaurant_id", rid).eq("id", selected.id), "Table updated");
  }
  async function arrival(r: Row<"reservations">, fire: boolean) {
    const tid = assignment[r.id] || r.table_id;
    if (!tid) { toast.error("Choose a table first"); return; }
    const prep = Math.max(0, ...orders.filter(o => o.reservation_id === r.id).flatMap(o => o.order_items.map(i => q.data?.menu.find(mi => mi.id === i.menu_item_id)?.prep_time_mins ?? 10)));
    const scheduled = computeFireAt(fireModeOf(settingsOf(q.data?.restaurant ?? m.restaurants)), r.eta_time ? new Date(r.eta_time) : new Date(`${r.booking_date}T${r.arrival_time}`), prep, new Date());
    await run(() => supabase.rpc("foh_reservation_action", { _restaurant_id: rid, _reservation_id: r.id, _table_id: tid, _fire: fire, _scheduled_fire_at: scheduled ?? undefined }), fire ? "Guest arrived — fired to Incoming" : "Approved and table assigned");
  }
  async function seatWalkin(e: React.FormEvent) {
    e.preventDefault(); if (!walkTable) return;
    const ok = await run(async () => {
      const res = await supabase.from("reservations").insert({ restaurant_id: rid, customer_name: name.trim() || "Walk-in", party_size: party, table_id: walkTable, booking_date: new Date().toLocaleDateString("en-CA"), arrival_time: new Date().toTimeString().slice(0,8), status: "seated" });
      if (res.error) return res;
      return supabase.from("tables").update({ status: "occupied" }).eq("restaurant_id", rid).eq("id", walkTable);
    }, "Walk-in seated");
    if (ok) { setSel(walkTable); setWalkin(false); setName(""); setView("floor"); }
  }
  async function manualOrder() {
    if (!selected) return;
    const items = Object.entries(cart).filter(([id,n]) => n > 0 && q.data?.menu.some(i => i.id === id && i.is_available)).map(([menu_item_id, quantity]) => ({ menu_item_id, quantity }));
    if (!items.length) return;
    const ok = await run(() => supabase.rpc("foh_manual_order", { _restaurant_id: rid, _table_id: selected.id, _items: items, _notes: notes }), "Manual order sent to kitchen");
    if (ok) { setPos(false); setCart({}); setNotes(""); }
  }
  return <div className="foh-shell min-h-screen bg-background">
    <nav className="foh-rail flex flex-col items-center gap-3 bg-sidebar px-2 py-5 text-sidebar-foreground">
      <div className="mb-5 grid h-12 w-12 place-items-center rounded-lg bg-electric text-electric-foreground"><Armchair className="h-7 w-7" /></div>
      {VIEWS.map(v => <Button key={v.id} variant="ghost" title={v.name} aria-label={v.name} aria-pressed={view === v.id} onClick={() => setView(v.id)} className={`relative h-16 w-16 flex-col gap-1 whitespace-normal px-1 text-[10px] leading-tight ${view === v.id ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground"}`}><v.icon className="h-6 w-6" />{v.id === "preorders" ? "Pre-Orders" : v.name}{v.id === "preorders" && pending > 0 && <span className="absolute right-1 top-1 rounded-full bg-destructive px-1.5 text-destructive-foreground">{pending}</span>}</Button>)}
      <Button asChild variant="ghost" className="mt-auto h-12 w-12" title="My workspace"><Link to="/app"><ArrowLeft /></Link></Button>
    </nav>
    <main className="min-w-0">
      <header className="border-b bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3"><div className="mr-auto"><h1 className="text-xl font-bold">Front of House</h1><p className="text-sm text-muted-foreground">{m.restaurants.name} · {new Date(now).toLocaleTimeString("en-AU", {hour:"2-digit", minute:"2-digit"})}</p></div>{!!q.data?.restaurant?.kitchen_delay_minutes && <span className="rounded bg-warning/15 p-2 font-semibold text-warning-foreground">Kitchen +5m</span>}<Button variant="electric" className="h-12" onClick={() => setWalkin(true)}><Plus />Seat Walk-In</Button><Button variant="outline" className="relative h-12 w-12" aria-label="Notifications" onClick={() => setNotice(true)}><Bell />{alerts.length > 0 && <span className="absolute right-0 top-0 rounded-full bg-electric px-1 text-xs text-electric-foreground">{alerts.length}</span>}</Button></div>
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-1">{ZONES.map(z => <Button key={z} variant={zone === z ? "secondary" : "ghost"} className="h-12" onClick={() => setZone(z)}>{z}</Button>)}</div><div className="flex flex-wrap gap-2 text-xs">{([['available','Available'],['reserved','Reserved'],['occupied','Occupied'],['bill_requested','Bill Req'],['cleaning','Cleaning']] as const).map(([s,l]) => <span key={s} className={`rounded-md border px-2 py-2 font-semibold ${s === 'bill_requested' ? 'border-electric/40 bg-electric/10 text-electric' : TABLE_STATUS_CLASS[s]}`}>{l} <span className="tabular">{tables.filter(t => t.status === s).length}</span></span>)}</div></div>
      </header>
      {q.isError ? <div className="p-8 text-destructive">Unable to load service data. <Button variant="outline" onClick={() => refresh()}>Retry</Button></div> : q.isLoading ? <div className="p-8 text-muted-foreground">Loading live service…</div> : <div className="foh-workspace">
        <section className="min-w-0 p-5">
          <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">{VIEWS.find(v => v.id === view)?.name}</h2><span className="flex items-center gap-2 text-xs text-success"><span className="h-2 w-2 rounded-full bg-success" />Live service</span></div>
          {view === "floor" && <div className="foh-floor">{tables.filter(t => zone === "All Zones" || t.zone === zone).map(t => {
            const booking = reservations.find(r => r.table_id === t.id && !["completed","cancelled","no_show"].includes(r.status));
            return <Button key={t.id} variant="ghost" aria-label={`Table ${t.table_number}`} onClick={() => setSel(t.id)} className={`foh-table h-36 flex-col whitespace-normal border-2 text-center ${t.shape === 'round' ? 'rounded-full' : 'rounded-lg'} ${t.shape === 'rectangle' ? 'foh-rectangle' : ''} ${t.status === 'bill_requested' ? 'border-electric/40 bg-electric/10 text-electric animate-pulse' : TABLE_STATUS_CLASS[t.status]} ${sel === t.id ? 'ring-2 ring-electric ring-offset-2' : ''}`}><span className="tabular text-xl font-bold">{t.table_number}</span><span className="text-xs">{t.capacity} guests · {t.zone}</span><span className="font-semibold">{label(t.status)}</span>{['occupied','waiting_food','bill_requested'].includes(t.status) && <span className="tabular text-xs">{elapsedDining(t.status_changed_at, now)}m</span>}{t.status === 'reserved' && booking && <span className="tabular text-xs">ETA {new Date(booking.eta_time ?? `${booking.booking_date}T${booking.arrival_time}`).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'})}</span>}</Button>;
          })}</div>}
          {view === "preorders" && <div className="space-y-3">{preorders.map(r => <article key={r.id} className="rounded-lg border bg-card p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="text-lg font-bold">{r.customer_name}</h3><span className="tabular">ETA {new Date(r.eta_time ?? `${r.booking_date}T${r.arrival_time}`).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'})}</span></div><p className="mt-1 text-sm text-muted-foreground">{r.party_size} guests · {label(r.status)}</p><div className="my-3 flex flex-wrap gap-2"><span className={`rounded px-2 py-1 text-sm font-semibold ${r.pre_order_paid_amount > 0 ? 'bg-success/10 text-success' : 'bg-warning/15 text-warning-foreground'}`}>{r.pre_order_paid_amount > 0 ? `Deposit Paid ${money(r.pre_order_paid_amount,cur)}` : 'Deposit unpaid'}</span>{r.is_proximity_verified && <span className="flex items-center gap-1 rounded bg-electric/10 px-2 py-1 text-sm text-electric"><MapPin className="h-4 w-4" />GPS Verified &lt;2km</span>}{etaHold(r.eta_change_count,r.is_proximity_verified) && <span className="flex items-center gap-1 rounded bg-warning/15 px-2 py-1 text-sm text-warning-foreground"><TriangleAlert className="h-4 w-4" />Unverified ETA — Hold Kitchen Fire</span>}</div>{r.dietary_notes && <p className="mb-3 text-sm font-semibold text-destructive">{r.dietary_notes}</p>}<p className="mb-3 text-sm">{orders.filter(o => o.reservation_id === r.id).flatMap(o => o.order_items.map(i => `${i.quantity}× ${i.name}`)).join(', ')}</p><div className="flex flex-wrap gap-2"><select aria-label={`Assign table for ${r.customer_name}`} className="h-12 min-w-32 rounded-md border bg-background px-2" value={assignment[r.id] ?? r.table_id ?? ''} onChange={e => setAssignment(a => ({...a,[r.id]:e.target.value}))}><option value="">Choose table</option>{tables.filter(t => (t.status === 'available' || t.id === r.table_id) && t.capacity >= r.party_size).map(t => <option key={t.id} value={t.id}>{t.table_number} · {t.capacity}p</option>)}</select><Button className="h-12" disabled={busy} variant="electric" onClick={() => arrival(r,false)}>Approve & Assign Table</Button><Button className="h-12 whitespace-normal" disabled={busy} variant="warning" onClick={() => arrival(r,true)}><Flame />Guest Arrived — Fire to Kitchen</Button></div></article>)}{!preorders.length && <Empty text="No incoming pre-orders" />}</div>}
          {view === "orders" && <div className="space-y-3">{orders.filter(o => o.status !== 'served').map(o => <article key={o.id} className="rounded-lg border bg-card p-4"><div className="flex justify-between"><h3 className="tabular font-bold">#{o.order_number} · {tables.find(t => t.id === o.table_id)?.table_number ?? 'Pre-Order'}</h3><span className={o.status === 'ready' ? 'font-bold text-success' : 'text-muted-foreground'}>{label(o.status)}</span></div><p className="my-2">{o.order_items.map(i => `${i.quantity}× ${i.name}`).join(', ')}</p><Button variant="outline" className="h-12" onClick={() => {setSel(o.table_id);setView('floor');}}>Open table</Button>{o.status === 'ready' && <Button variant="success" className="ml-2 h-12" disabled={busy} onClick={() => run(() => supabase.from('orders').update({status:'served'}).eq('restaurant_id',rid).eq('id',o.id),'Order served')}>Mark Served</Button>}</article>)}{!orders.some(o => o.status !== 'served') && <Empty text="No active orders" />}</div>}
          {view === "waitlist" && <div className="space-y-3">{reservations.filter(r => ['pending','confirmed','arriving_soon','checked_in'].includes(r.status)).map(r => <article key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4"><div className="mr-auto"><h3 className="font-bold">{r.customer_name}</h3><p className="text-sm text-muted-foreground">{r.party_size} guests · {r.arrival_time.slice(0,5)} · {label(r.status)}</p></div><Button className="h-12" variant="outline" disabled={busy} onClick={() => run(() => supabase.from('reservations').update({status:'checked_in'}).eq('restaurant_id',rid).eq('id',r.id),'Guest checked in')}>Check In</Button><Button className="h-12" variant="secondary" disabled={busy} onClick={() => run(() => supabase.from('reservations').update({status:'no_show'}).eq('restaurant_id',rid).eq('id',r.id),'Marked no-show')}>No-Show</Button><Button className="h-12" onClick={() => {setView('floor');setSel(r.table_id);}}>Seat / Assign</Button></article>)}{!reservations.some(r => ['pending','confirmed','arriving_soon','checked_in'].includes(r.status)) && <Empty text="No guests waiting" />}</div>}
          {view === "bills" && <div className="space-y-3">{tables.filter(t => orders.some(o => o.table_id === t.id && o.payment_status !== 'paid')).map(t => <article key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4"><h3 className="mr-auto font-bold">{t.table_number}</h3><span className="tabular text-xl font-bold">{money(orders.filter(o => o.table_id === t.id && o.payment_status !== 'paid').reduce((s,o) => s + Number(o.total_amount),0),cur)}</span><Button className="h-12" variant="success" disabled={busy} onClick={() => run(() => supabase.rpc('foh_pay_bill',{_restaurant_id:rid,_table_id:t.id}),'Bill recorded paid — table ready for cleaning')}>Mark Bill Paid</Button></article>)}{!orders.some(o => o.table_id && o.payment_status !== 'paid') && <Empty text="No outstanding table bills" />}</div>}
        </section>
        <aside className="border-l bg-card p-5">
          {selected ? <><div className="mb-5 flex items-center justify-between"><div><h2 className="tabular text-2xl font-bold">{selected.table_number}</h2><p className="text-sm text-muted-foreground">{selected.zone} · {selected.capacity} seats</p></div><Button variant="ghost" aria-label="Close table" onClick={() => setSel(null)}><X /></Button></div><div className="mb-5 border-b pb-4"><p className="font-semibold">{activeRes?.customer_name ?? 'Walk-in table'}</p>{activeRes && <p className="text-sm text-muted-foreground">{activeRes.party_size} guests · {activeRes.customer_phone}</p>}{activeRes?.dietary_notes && <p className="mt-2 rounded bg-destructive/10 p-2 font-semibold text-destructive">{activeRes.dietary_notes}</p>}</div><div className="grid grid-cols-2 gap-2">{([['occupied','Seated'],['waiting_food','Waiting for Food'],['bill_requested','Bill Requested'],['available','Mark Clean']] as const).map(([s,l]) => <Button key={s} variant={selected.status === s ? 'electric' : 'outline'} className="h-14 whitespace-normal" disabled={busy} onClick={() => changeTable(s)}>{l}</Button>)}</div><Button variant="electric" className="mt-4 h-14 w-full" onClick={() => setPos(true)}><Plus />Add Manual Order</Button><Button variant="warning" className="mt-2 h-14 w-full" disabled={busy || !tableOrders.some(o => ['incoming','accepted'].includes(o.status))} onClick={() => run(() => supabase.from('orders').update({status:'incoming',fired_manually:true,scheduled_fire_at:null}).eq('restaurant_id',rid).eq('table_id',selected.id).in('status',['incoming','accepted']),'Next course fired to kitchen')}><Flame />Fire Next Course</Button><h3 className="mb-2 mt-6 font-bold">Active orders</h3>{tableOrders.map(o => <div key={o.id} className="border-b py-3"><div className="flex justify-between font-semibold"><span className="tabular">#{o.order_number}</span><span>{label(o.status)}</span></div>{o.order_items.map(i => <p key={i.id} className="mt-1 text-sm">{i.quantity}× {i.name}<span className="ml-2 text-muted-foreground">{label(i.item_status)}</span></p>)}<p className="mt-2 text-xs text-muted-foreground">{label(o.payment_status)}</p></div>)}{!tableOrders.length && <p className="text-sm text-muted-foreground">No orders on this table</p>}<div className="mt-5 flex justify-between font-bold"><span>Outstanding</span><span className="tabular">{money(due,cur)}</span></div><Button variant="success" className="mt-3 h-14 w-full" disabled={busy || due <= 0} onClick={() => run(() => supabase.rpc('foh_pay_bill',{_restaurant_id:rid,_table_id:selected.id}),'Bill recorded paid — mark clean after clearing')}><CreditCard />Mark Bill Paid</Button></> : <div className="grid min-h-64 place-items-center text-center text-muted-foreground"><div><Armchair className="mx-auto mb-4 h-12 w-12" /><h2 className="text-lg font-semibold">No table selected</h2></div></div>}
        </aside>
      </div>}
    </main>
    <Sheet open={notice} onOpenChange={setNotice}><SheetContent><SheetHeader><SheetTitle>Service Notifications</SheetTitle></SheetHeader><div className="mt-5 space-y-3">{alerts.map((a,i) => <p key={i} className="rounded-lg border p-3">{a}</p>)}{orders.filter(o => o.status === 'ready').map(o => <p key={o.id} className="rounded-lg border border-success/40 bg-success/10 p-3 text-success">#{o.order_number} ready · {tables.find(t => t.id === o.table_id)?.table_number ?? 'Pre-Order'}</p>)}{!alerts.length && !orders.some(o => o.status === 'ready') && <p className="text-muted-foreground">No new notifications</p>}</div></SheetContent></Sheet>
    <Dialog open={walkin} onOpenChange={setWalkin}><DialogContent><DialogHeader><DialogTitle>Seat Walk-In</DialogTitle></DialogHeader><form onSubmit={seatWalkin} className="space-y-4"><div><Label htmlFor="walk-name">Guest name</Label><Input id="walk-name" value={name} onChange={e => setName(e.target.value)} className="h-12" /></div><div><Label htmlFor="walk-party">Party size</Label><Input id="walk-party" type="number" min={1} max={30} value={party} onChange={e => setParty(Number(e.target.value))} required className="h-12" /></div><div><Label htmlFor="walk-table">Available table</Label><select id="walk-table" required className="h-12 w-full rounded-md border bg-background px-3" value={walkTable} onChange={e => setWalkTable(e.target.value)}><option value="">Choose table</option>{available.filter(t => t.capacity >= party).map(t => <option key={t.id} value={t.id}>{t.table_number} · {t.zone} · {t.capacity} seats</option>)}</select></div><Button type="submit" className="h-12 w-full" disabled={busy || !walkTable}>Seat Guest</Button></form></DialogContent></Dialog>
    <Dialog open={pos} onOpenChange={setPos}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Manual Order · {selected?.table_number}</DialogTitle></DialogHeader><Input aria-label="Search menu" placeholder="Search dishes…" value={search} onChange={e => setSearch(e.target.value)} className="h-12" /><div className="max-h-[40vh] overflow-y-auto">{q.data?.menu.filter(i => i.name.toLowerCase().includes(search.toLowerCase())).map(i => <div key={i.id} className="flex items-center gap-2 border-b py-3"><div className="mr-auto min-w-0"><p className={`font-semibold ${i.is_available ? '' : 'text-muted-foreground line-through'}`}>{i.name}</p><p className="text-xs text-muted-foreground">{i.is_available ? `${money(i.price,cur)} · ${i.station}` : "86'd — unavailable"}</p></div><Button variant="outline" className="h-12 w-12" aria-label={`Remove ${i.name}`} disabled={!cart[i.id]} onClick={() => setCart(c => ({...c,[i.id]:Math.max(0,(c[i.id] ?? 0)-1)}))}><Minus /></Button><span className="tabular w-6 text-center">{cart[i.id] ?? 0}</span><Button variant="outline" className="h-12 w-12" aria-label={`Add ${i.name}`} disabled={!i.is_available || (cart[i.id] ?? 0) >= 20} onClick={() => setCart(c => ({...c,[i.id]:(c[i.id] ?? 0)+1}))}><Plus /></Button></div>)}</div><Label htmlFor="pos-notes">Allergies / special instructions</Label><Input id="pos-notes" value={notes} onChange={e => setNotes(e.target.value)} className="h-12" /><Button variant="electric" className="h-14" disabled={busy || !q.data?.menu.some(i => i.is_available && (cart[i.id] ?? 0) > 0)} onClick={manualOrder}>Send to Kitchen</Button></DialogContent></Dialog>
  </div>;
}
function Empty({ text }: { text: string }) { return <div className="border-y border-dashed py-16 text-center text-muted-foreground">{text}</div>; }
