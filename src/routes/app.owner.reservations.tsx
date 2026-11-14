import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Flame, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money, settingsOf, useMembership, membershipQuery, type Row } from "@/lib/tenant";
import { useLiveTables } from "@/lib/realtime";
import { useDateRange, ymd } from "@/lib/date-range";
import { FIRE_MODES, fireModeOf, type FireMode } from "@/lib/preorder";
import { antiGhostOf } from "@/lib/antighost";
import { label } from "@/lib/status";
import { PageHeader, Panel, Pill } from "@/components/tf/Ui";
import { emptyRes, ReservationFields, toPayload, type ResForm } from "@/components/tf/ReservationForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Search = { id?: string | undefined };
export const Route = createFileRoute("/app/owner/reservations")({
  validateSearch: (s: Record<string, unknown>): Search => ({ id: typeof s["id"] === "string" ? s["id"] : undefined }),
  component: Reservations,
});

const STATUSES = ["pending", "confirmed", "arriving_soon", "checked_in", "seated", "completed", "cancelled", "no_show"] as const;
type Status = (typeof STATUSES)[number];
const STATUS_CLS: Record<Status, string> = {
  pending: "border-warning/50 bg-warning/10 text-warning-foreground", confirmed: "border-electric/40 bg-electric/10 text-electric",
  arriving_soon: "border-electric/60 bg-electric/20 text-electric", checked_in: "border-success/40 bg-success/10 text-success",
  seated: "border-success/60 bg-success/20 text-success", completed: "border-border bg-muted text-muted-foreground",
  cancelled: "border-destructive/40 bg-destructive/10 text-destructive", no_show: "border-destructive/60 bg-destructive/20 text-destructive",
};
const VIEWS = [["list", "List & Schedule"], ["timeline", "Daily Timeline"], ["calendar", "Calendar View"], ["waitlist", "Waitlist / No-Shows"]] as const;
type Res = Row<"reservations"> & { tables: { table_number: string } | null };

function Reservations() {
  const { data: m } = useMembership();
  const rid = m!.restaurant_id;
  const qc = useQueryClient();
  const navigate = useNavigate({ from: "/app/owner/reservations" });
  const { id: openId } = Route.useSearch();
  const { from, to } = useDateRange();
  const [view, setView] = useState<(typeof VIEWS)[number][0]>("list");
  const [status, setStatus] = useState<Status | "all">("all");
  const [creating, setCreating] = useState(false);
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [day, setDay] = useState(ymd(new Date()));

  const q = useQuery({
    queryKey: ["res-all", rid],
    queryFn: async () => {
      const { data, error } = await supabase.from("reservations").select("*, tables(table_number)").eq("restaurant_id", rid)
        .gte("booking_date", ymd(addDays(new Date(), -60))).order("booking_date").order("arrival_time");
      if (error) throw error;
      return data as Res[];
    },
  });
  useLiveTables(rid, ["reservations"], [["res-all", rid]]);
  const all = q.data ?? [];
  const inRange = all.filter((r) => r.booking_date >= ymd(from) && r.booking_date < ymd(to));
  const counts = Object.fromEntries(STATUSES.map((s) => [s, inRange.filter((r) => r.status === s).length])) as Record<Status, number>;
  const list = status === "all" ? inRange : inRange.filter((r) => r.status === status);
  const open = all.find((r) => r.id === openId);
  const setOpen = (id?: string) => navigate({ search: { id }, replace: true });
  const gpsHold = antiGhostOf(settingsOf(m!.restaurants)).gps_hold;

  return (
    <>
      <PageHeader title="Reservations" sub="Bookings, arrivals and ETA pre-orders" action={<Button variant="electric" onClick={() => setCreating(true)}><Plus />Create Reservation</Button>} />
      <FireModeCard />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {VIEWS.map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === v ? "bg-card shadow-card" : "text-muted-foreground"}`}>{l}</button>
          ))}
        </div>
      </div>

      {view === "list" && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["all", ...STATUSES] as const).map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={`rounded-full border px-3 py-1 text-xs font-medium ${status === s ? "border-navy bg-navy text-primary-foreground" : "bg-card hover:border-electric/40"}`}>
                {s === "all" ? "All" : label(s).replace("No Show", "No-Show")} <span className="tabular ml-1 opacity-70">{s === "all" ? inRange.length : counts[s]}</span>
              </button>
            ))}
          </div>
          <Panel className="mt-4 overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                <tr>{["Date", "Time", "ETA", "Guest", "Party", "Table", "Notes", "Protection", "Status"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {list.map((r) => (
                  <tr key={r.id} onClick={() => setOpen(r.id)} className="cursor-pointer hover:bg-muted/40">
                    <td className="tabular px-4 py-3">{format(new Date(r.booking_date + "T00:00"), "EEE d MMM")}</td>
                    <td className="tabular px-4 py-3">{r.arrival_time.slice(0, 5)}</td>
                    <td className="tabular px-4 py-3 text-muted-foreground">{r.eta_time ? format(new Date(r.eta_time), "HH:mm") : "—"}</td>
                    <td className="px-4 py-3"><div className="font-medium">{r.customer_name}</div><div className="text-xs text-muted-foreground">{r.customer_phone}</div></td>
                    <td className="tabular px-4 py-3">{r.party_size}</td>
                    <td className="tabular px-4 py-3">{r.tables?.table_number ?? "—"}</td>
                    <td className="max-w-56 truncate px-4 py-3 text-xs text-muted-foreground">{[r.dietary_notes, r.special_requests].filter(Boolean).join(" · ")}</td>
                    <td className="px-4 py-3">{r.deposit_paid ? <Pill className="border-success/40 text-success">Paid</Pill> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.pre_order_paid_amount > 0 && <Pill className="border-success/40 bg-success/10 text-success">Deposit {money(r.pre_order_paid_amount, m!.restaurants.currency)}</Pill>}
                        {r.is_proximity_verified && <Pill className="border-electric/40 bg-electric/10 text-electric">GPS &lt;2km</Pill>}
                        {gpsHold && r.eta_change_count >= 1 && !r.is_proximity_verified && <Pill className="border-warning/60 bg-warning/15 text-warning-foreground"><TriangleAlert className="mr-1 h-3 w-3" />Unverified ETA — Hold Fire</Pill>}
                      </div>
                    </td>
                    <td className="px-4 py-3"><Pill className={STATUS_CLS[r.status]}>{label(r.status)}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.length && <p className="p-8 text-center text-sm text-muted-foreground">No reservations for this filter and date range.</p>}
          </Panel>
        </>
      )}

      {view === "timeline" && <Timeline day={day} setDay={setDay} rows={all.filter((r) => r.booking_date === day && r.status !== "cancelled")} onOpen={setOpen} rid={rid} />}

      {view === "calendar" && (
        <Panel className="mt-4">
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft /></Button>
            <h2 className="font-semibold">{format(month, "MMMM yyyy")}</h2>
            <Button variant="ghost" size="icon" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight /></Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) }).map((d) => {
              const rs = all.filter((r) => r.booking_date === ymd(d) && r.status !== "cancelled");
              const covers = rs.reduce((s, r) => s + r.party_size, 0);
              return (
                <button key={d.toISOString()} onClick={() => { setDay(ymd(d)); setView("timeline"); }}
                  className={`min-h-20 rounded-lg border p-2 text-left hover:border-electric/50 ${isSameMonth(d, month) ? "bg-card" : "bg-muted/40 text-muted-foreground"} ${ymd(d) === ymd(new Date()) ? "ring-2 ring-electric" : ""}`}>
                  <div className="tabular text-xs font-semibold">{format(d, "d")}</div>
                  {rs.length > 0 && <div className="mt-2 space-y-0.5 text-[11px]"><div className="font-medium text-electric">{rs.length} bookings</div><div className="text-muted-foreground">{covers} covers</div></div>}
                </button>
              );
            })}
          </div>
        </Panel>
      )}

      {view === "waitlist" && <Waitlist rows={all} onOpen={setOpen} />}

      <CreateDialog open={creating} onOpenChange={setCreating} rid={rid} onDone={() => qc.invalidateQueries({ queryKey: ["res-all", rid] })} />
      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(undefined)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {open && <Details key={open.id} r={open} cur={m!.restaurants.currency} gpsHold={gpsHold} onSaved={() => qc.invalidateQueries({ queryKey: ["res-all", rid] })} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function FireModeCard() {
  const { data: m } = useMembership();
  const qc = useQueryClient();
  const mode = fireModeOf(settingsOf(m!.restaurants));
  async function set(v: FireMode) {
    const { error } = await supabase.from("restaurants").update({ settings_json: { ...settingsOf(m!.restaurants), preorder_fire_mode: v } }).eq("id", m!.restaurant_id);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: membershipQuery.queryKey });
    toast.success("Pre-order firing updated");
  }
  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-4">
        <div className="mr-auto flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-warning/15 text-warning-foreground"><Flame className="h-5 w-5" /></span>
          <div><div className="font-semibold">Smart ETA Pre-Order Scheduler</div><div className="text-xs text-muted-foreground">{FIRE_MODES.find((f) => f.value === mode)?.hint}</div></div>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {FIRE_MODES.map((f) => (
            <button key={f.value} onClick={() => set(f.value)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${mode === f.value ? "bg-card text-foreground shadow-card" : "text-muted-foreground"}`}>{f.label}</button>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function Timeline({ day, setDay, rows, onOpen, rid }: { day: string; setDay: (d: string) => void; rows: Res[]; onOpen: (id: string) => void; rid: string }) {
  const tables = useQuery({ queryKey: ["tables", rid], queryFn: async () => (await supabase.from("tables").select("*").eq("restaurant_id", rid).order("table_number")).data ?? [] });
  const START = 11, END = 24, span = END - START;
  const lanes = [...(tables.data ?? []).map((t) => ({ id: t.id as string | null, name: t.table_number })), { id: null, name: "Unassigned" }];
  const pos = (t: string) => { const [h = 0, mm = 0] = t.split(":").map(Number); return ((h + mm / 60 - START) / span) * 100; };
  return (
    <Panel className="mt-4 overflow-x-auto">
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setDay(ymd(addDays(new Date(day + "T00:00"), -1)))} aria-label="Previous day"><ChevronLeft /></Button>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-sm" />
        <Button variant="ghost" size="icon" onClick={() => setDay(ymd(addDays(new Date(day + "T00:00"), 1)))} aria-label="Next day"><ChevronRight /></Button>
        <span className="ml-2 text-sm text-muted-foreground">{rows.length} bookings · {rows.reduce((s, r) => s + r.party_size, 0)} covers</span>
      </div>
      <div className="min-w-[900px]">
        <div className="relative ml-24 h-6 border-b text-[11px] text-muted-foreground">
          {Array.from({ length: span }, (_, i) => <span key={i} className="tabular absolute" style={{ left: `${(i / span) * 100}%` }}>{START + i}:00</span>)}
        </div>
        {lanes.map((l) => (
          <div key={l.name} className="flex h-11 items-center border-b last:border-0">
            <div className="tabular w-24 shrink-0 text-sm font-medium">{l.name}</div>
            <div className="relative h-full flex-1">
              {rows.filter((r) => r.table_id === l.id).map((r) => (
                <button key={r.id} onClick={() => onOpen(r.id)} style={{ left: `${pos(r.arrival_time)}%`, width: `${(1.75 / span) * 100}%` }}
                  className={`absolute top-1.5 h-8 truncate rounded-md border px-2 text-left text-xs font-medium ${STATUS_CLS[r.status]}`}>
                  {r.customer_name} · {r.party_size}p
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Waitlist({ rows, onOpen }: { rows: Res[]; onOpen: (id: string) => void }) {
  const now = new Date();
  const late = rows.filter((r) => ["pending", "confirmed", "arriving_soon"].includes(r.status) && new Date(`${r.booking_date}T${r.arrival_time}`).getTime() < now.getTime() - 15 * 60000);
  const waiting = rows.filter((r) => r.status === "pending" && r.booking_date >= ymd(now));
  const noShows = rows.filter((r) => r.status === "no_show" || r.status === "cancelled").reverse();
  const col = (title: string, rs: Res[], hint: string) => (
    <Panel>
      <h2 className="font-semibold">{title} <span className="tabular text-muted-foreground">{rs.length}</span></h2>
      <p className="mb-3 text-xs text-muted-foreground">{hint}</p>
      <ul className="space-y-2">
        {rs.map((r) => (
          <li key={r.id}><button onClick={() => onOpen(r.id)} className="w-full rounded-lg border p-3 text-left hover:border-electric/40">
            <div className="flex justify-between text-sm"><span className="font-medium">{r.customer_name}</span><Pill className={STATUS_CLS[r.status]}>{label(r.status)}</Pill></div>
            <div className="tabular mt-1 text-xs text-muted-foreground">{r.booking_date} · {r.arrival_time.slice(0, 5)} · {r.party_size}p</div>
          </button></li>
        ))}
        {!rs.length && <li className="text-sm text-muted-foreground">Nothing here.</li>}
      </ul>
    </Panel>
  );
  return <div className="mt-4 grid gap-4 lg:grid-cols-3">{col("Awaiting confirmation", waiting, "Pending requests to confirm")}{col("Running late", late, "15+ minutes past arrival, not checked in")}{col("No-shows & cancellations", noShows, "Recent history")}</div>;
}

function CreateDialog({ open, onOpenChange, rid, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; rid: string; onDone: () => void }) {
  const [f, setF] = useState<ResForm>(emptyRes(ymd(new Date())));
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("reservations").insert({ ...toPayload(f), restaurant_id: rid, status: "confirmed" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Reservation created");
    setF(emptyRes(ymd(new Date())));
    onOpenChange(false);
    onDone();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Create Reservation</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-6">
          <ReservationFields value={f} onChange={setF} />
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="electric" disabled={busy}>Create reservation</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Details({ r, cur, gpsHold, onSaved }: { r: Res; cur: string; gpsHold: boolean; onSaved: () => void }) {
  const [f, setF] = useState<ResForm>({
    customer_name: r.customer_name, customer_phone: r.customer_phone ?? "", customer_email: r.customer_email ?? "", party_size: r.party_size,
    booking_date: r.booking_date, arrival_time: r.arrival_time.slice(0, 5), eta: r.eta_time ? format(new Date(r.eta_time), "HH:mm") : "",
    seating_preference: r.seating_preference ?? "No preference", dietary_notes: r.dietary_notes ?? "", special_requests: r.special_requests ?? "", deposit_paid: r.deposit_paid,
  });
  const qc = useQueryClient();
  const pre = useQuery({
    queryKey: ["res-preorders", r.id],
    queryFn: async () => (await supabase.from("orders").select("id,order_number,status,total_amount,scheduled_fire_at,order_items(name,quantity)").eq("reservation_id", r.id)).data ?? [],
  });
  const patchStatus = async (status: Status) => {
    const { error } = await supabase.from("reservations").update({ status }).eq("id", r.id);
    if (error) toast.error(error.message); else onSaved();
  };
  const gpsHoldProp = gpsHold;
  const unverified = gpsHoldProp && r.eta_change_count >= 1 && !r.is_proximity_verified;
  const unpaid = r.pre_order_paid_amount <= 0;
  async function save() {
    const { error } = await supabase.from("reservations").update(toPayload(f)).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    onSaved();
  }
  async function fire(id: string) {
    const { error } = await supabase.from("orders").update({ status: "accepted", scheduled_fire_at: null, fired_manually: true }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Fired to kitchen"); qc.invalidateQueries({ queryKey: ["res-preorders", r.id] }); }
  }
  const [confirmFire, setConfirmFire] = useState<string | null>(null);
  const held = (s: string | null) => s !== null && (s === "infinity" || new Date(s) > new Date());
  return (
    <>
      <SheetHeader><SheetTitle>Reservation Details</SheetTitle></SheetHeader>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {r.pre_order_paid_amount > 0 && <Pill className="border-success/40 bg-success/10 text-success">Deposit Paid ({money(r.pre_order_paid_amount, cur)})</Pill>}
        {r.is_proximity_verified && <Pill className="border-electric/40 bg-electric/10 text-electric">GPS Verified (&lt;2km)</Pill>}
        {unverified && <Pill className="border-warning/60 bg-warning/15 text-warning-foreground"><TriangleAlert className="mr-1 h-3 w-3" />Unverified ETA — Hold Kitchen Fire</Pill>}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => patchStatus(s)} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${r.status === s ? STATUS_CLS[s] : "text-muted-foreground hover:bg-muted"}`}>{label(s)}</button>
        ))}
      </div>
      <div className="mt-6"><ReservationFields value={f} onChange={setF} /></div>
      <div className="mt-6 rounded-xl border p-4">
        <div className="mb-2 text-sm font-semibold">Pre-ordered dishes</div>
        {pre.data?.length ? pre.data.map((o) => (
          <div key={o.id} className="border-t py-2 first:border-0 first:pt-0">
            <div className="flex items-center justify-between text-sm">
              <span className="tabular font-medium">#{o.order_number}</span>
              <span className="flex items-center gap-2">
                <Pill>{o.status === "accepted" && held(o.scheduled_fire_at) ? (o.scheduled_fire_at === "infinity" ? "Held — manual fire" : `Fires ${format(new Date(o.scheduled_fire_at!), "HH:mm")}`) : label(o.status)}</Pill>
                <span className="tabular">{money(o.total_amount, cur)}</span>
              </span>
            </div>
            <ul className="mt-1 text-xs text-muted-foreground">{o.order_items.map((i, idx) => <li key={idx}>{i.quantity}× {i.name}</li>)}</ul>
            {o.status === "accepted" && held(o.scheduled_fire_at) && (
              unpaid && unverified
                ? <Button size="sm" variant="warning" className="mt-2" onClick={() => setConfirmFire(o.id)}><Flame />Fire to KDS</Button>
                : <Button size="sm" variant="warning" className="mt-2" onClick={() => fire(o.id)}><Flame />Fire to KDS</Button>
            )}
            {o.status === "incoming" && <Pill className="mt-2 border-warning/50 text-warning-foreground">Awaiting approval — Approve in Overview</Pill>}
          </div>
        )) : <p className="text-xs text-muted-foreground">No pre-order for this booking.</p>}
      </div>
      <Dialog open={!!confirmFire} onOpenChange={(v) => !v && setConfirmFire(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Fire to kitchen without protection?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This guest has no deposit paid and no GPS verification. If they don't arrive, the prepared food goes to waste.
            Fire this pre-order anyway?
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmFire(null)}>Keep holding</Button>
            <Button variant="warning" onClick={() => { const id = confirmFire; setConfirmFire(null); if (id) fire(id); }}><Flame />Fire anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button variant="electric" className="mt-6 w-full" onClick={save}>Save changes</Button>
    </>
  );
}
