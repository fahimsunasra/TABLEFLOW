import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, MapPin, Minus, Plus, ShieldCheck, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money, settingsOf } from "@/lib/tenant";
import { antiGhostOf, depositDue, distanceKm, RESTAURANT_COORDS } from "@/lib/antighost";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Search = {
  table?: string | undefined;
  mode?: "book" | "preorder" | "track" | undefined;
  res?: string | undefined;
};

export const Route = createFileRoute("/guest/$restaurantSlug")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    table: typeof s["table"] === "string" ? s["table"] : undefined,
    mode: s["mode"] === "book" || s["mode"] === "preorder" || s["mode"] === "track" ? s["mode"] : undefined,
    res: typeof s["res"] === "string" ? s["res"] : undefined,
  }),
  head: ({ params }) => {
    const name = params.restaurantSlug.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
    return {
      meta: [
        { title: `${name} — Order & Book` },
        { name: "description", content: `View the menu, order from your table or book a table at ${name}.` },
        { property: "og:title", content: `${name} — Order & Book` },
        { property: "og:description", content: `Menu, table ordering and bookings for ${name}.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: Guest,
});

const MODES = [["menu", "Menu"], ["preorder", "Pre-Order"], ["book", "Book a table"]] as const;

function Guest() {
  const { restaurantSlug } = Route.useParams();
  const { table, mode, res: trackId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const setMode = (m: Search["mode"], extra?: Partial<Search>) => navigate({ search: { ...extra, table, mode: m } });
  const q = useQuery({
    queryKey: ["guest", restaurantSlug],
    queryFn: async () => {
      const { data: r, error } = await supabase.rpc("get_public_restaurant", { _slug: restaurantSlug }).maybeSingle();
      if (error) throw error;
      if (!r) return null;
      const [c, i] = await Promise.all([
        supabase.from("menu_categories").select("*").eq("restaurant_id", r.id).eq("is_active", true).order("sort_order"),
        supabase.from("menu_items").select("*").eq("restaurant_id", r.id).eq("is_available", true).order("name"),
      ]);
      return { r, cats: c.data ?? [], items: i.data ?? [] };
    },
  });

  if (q.isLoading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading menu…</div>;
  if (!q.data) return <div className="grid min-h-screen place-items-center p-6 text-center">Restaurant not found.</div>;
  const { r } = q.data;
  const active = mode === "book" || mode === "preorder" || mode === "track" ? mode : "menu";

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-32">
      <header className="bg-navy px-5 pb-6 pt-8 text-primary-foreground">
        <p className="text-xs uppercase tracking-widest opacity-70">{table ? `Table ${table}` : active === "book" ? "Online booking" : active === "preorder" ? "Pre-order before you arrive" : "Menu"}</p>
        <h1 className="mt-1 text-3xl font-bold">{r.name}</h1>
        <p className="text-sm opacity-70">{r.address}</p>
      </header>
      <nav className="sticky top-0 z-10 flex gap-1 border-b bg-background/95 px-4 py-2 backdrop-blur">
        {MODES.map(([m, l]) => (
          <button key={m} onClick={() => setMode(m === "menu" ? undefined : m)} className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${active === m ? "bg-navy text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{l}</button>
        ))}
      </nav>
      {active === "track" && trackId ? <Track rid={r.id} reservationId={trackId} cur={r.currency} /> :
        active === "preorder" ? <PreOrder data={q.data} onPlaced={(id) => setMode("track", { res: id })} /> :
        active === "book" ? <BookForm rid={r.id} /> :
        <MenuOrder data={q.data} table={table} />}
      <p className="mt-10 text-center text-xs text-muted-foreground">Powered by TABLEFLOW</p>
    </div>
  );
}

type GuestData = {
  r: { id: string; slug: string; currency: string; tax_rate: number; service_charge_pct: number; settings_json: unknown };
  cats: { id: string; name: string }[];
  items: { id: string; name: string; description: string | null; price: number; category_id: string | null; dietary_tags_array: string[]; is_popular: boolean }[];
};

function MenuOrder({ data, table }: { data: GuestData; table?: string | undefined }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [placed, setPlaced] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const cur = data.r.currency;
  const subtotal = useMemo(() => data.items.reduce((s, i) => s + (cart[i.id] ?? 0) * Number(i.price), 0), [cart, data.items]);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const add = (id: string, d: number) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + d) }));

  async function place() {
    if (!table) return;
    setBusy(true);
    const items = Object.entries(cart).filter(([, q]) => q > 0).map(([menu_item_id, quantity]) => ({ menu_item_id, quantity }));
    const { data: num, error } = await supabase.rpc("place_guest_order", { _slug: data.r.slug, _table_number: table, _items: items, _notes: notes });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setPlaced(num as number);
    setCart({});
  }

  if (placed)
    return (
      <div className="p-8 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success text-success-foreground"><ShoppingBag /></div>
        <h2 className="mt-4 text-xl font-bold">Order sent to the kitchen</h2>
        <p className="tabular mt-1 text-3xl font-bold text-electric">#{placed}</p>
        <Button variant="outline" className="mt-6" onClick={() => setPlaced(null)}>Order more</Button>
      </div>
    );

  return (
    <>
      <nav className="sticky top-0 z-[9] flex gap-2 overflow-x-auto border-b bg-background/95 px-4 py-3 backdrop-blur">
        {data.cats.map((c) => <a key={c.id} href={`#c-${c.id}`} className="shrink-0 rounded-full border px-3 py-1 text-sm">{c.name}</a>)}
      </nav>
      {data.cats.map((c) => (
        <section key={c.id} id={`c-${c.id}`} className="px-4 pt-6">
          <h2 className="mb-3 text-lg font-bold">{c.name}</h2>
          <div className="space-y-3">
            {data.items.filter((i) => i.category_id === c.id).map((i) => (
              <div key={i.id} className="flex gap-3 rounded-2xl border bg-card p-4 shadow-card">
                <div className="flex-1">
                  <div className="font-semibold">{i.name}{i.is_popular && <span className="ml-2 text-xs text-warning">★ Popular</span>}</div>
                  <p className="text-sm text-muted-foreground">{i.description}</p>
                  <div className="tabular mt-2 font-bold">{money(i.price, cur)}</div>
                </div>
                {table && (
                  <div className="flex flex-col items-center justify-end gap-1">
                    {(cart[i.id] ?? 0) > 0 && <>
                      <Button size="icon" variant="outline" onClick={() => add(i.id, -1)} aria-label="Remove one"><Minus /></Button>
                      <span className="tabular font-bold">{cart[i.id]}</span>
                    </>}
                    <Button size="icon" variant="electric" onClick={() => add(i.id, 1)} aria-label={`Add ${i.name}`}><Plus /></Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
      {table && count > 0 && (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t bg-card p-4 shadow-card">
          <Input placeholder="Notes for the kitchen (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="mb-3" />
          <Button variant="electric" size="xl" className="w-full justify-between" onClick={place} disabled={busy}>
            <span>Place order · {count} items</span>
            <span className="tabular">{money(subtotal * (1 + Number(data.r.tax_rate) / 100 + Number(data.r.service_charge_pct) / 100), cur)}</span>
          </Button>
        </div>
      )}
    </>
  );
}

function PreOrder({ data, onPlaced }: { data: GuestData; onPlaced: (reservationId: string) => void }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [f, setF] = useState({ name: "", phone: "", email: "", size: "2", date: new Date().toISOString().slice(0, 10), time: "19:00", notes: "" });
  const [pay, setPay] = useState<"card" | "apple_pay">("card");
  const [busy, setBusy] = useState(false);
  const cur = data.r.currency;
  const ag = antiGhostOf(settingsOf({ settings_json: data.r.settings_json } as never));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const add = (id: string, d: number) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + d) }));

  const subtotal = data.items.reduce((s, i) => s + (cart[i.id] ?? 0) * Number(i.price), 0);
  const withTax = subtotal * (1 + Number(data.r.tax_rate) / 100 + Number(data.r.service_charge_pct) / 100);
  const deposit = depositDue(subtotal * (1 + Number(data.r.tax_rate) / 100), ag.deposit_pct);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const canSubmit = count > 0 && f.name.trim() && f.phone.trim() && f.date && f.time;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    const items = Object.entries(cart).filter(([, q]) => q > 0).map(([menu_item_id, quantity]) => ({ menu_item_id, quantity }));
    const { data: out, error } = await supabase.rpc("place_guest_preorder", {
      _slug: data.r.slug, _name: f.name.trim(), _phone: f.phone.trim(), _email: f.email.trim(),
      _party_size: Number(f.size) || 2, _booking_date: f.date, _arrival_time: f.time, _items: items, _notes: f.notes,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const resId = (out as { reservation_id: string }).reservation_id;
    toast.success(`Deposit of ${money(deposit, cur)} captured — see you soon!`);
    onPlaced(resId);
  }

  return (
    <div className="p-4">
      <p className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed text-warning-foreground">
        Pre-order your food before you arrive and skip the wait. A {ag.deposit_pct}% deposit is captured at checkout.
        <b> Deposit is non-refundable once kitchen preparation begins.</b>
      </p>
      <div className="space-y-3">
        {data.items.map((i) => (
          <div key={i.id} className="flex gap-3 rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex-1">
              <div className="font-semibold">{i.name}{i.is_popular && <span className="ml-2 text-xs text-warning">★ Popular</span>}</div>
              <p className="text-sm text-muted-foreground">{i.description}</p>
              <div className="tabular mt-2 font-bold">{money(i.price, cur)}</div>
            </div>
            <div className="flex flex-col items-center justify-end gap-1">
              {(cart[i.id] ?? 0) > 0 && <>
                <Button size="icon" variant="outline" onClick={() => add(i.id, -1)} aria-label="Remove one"><Minus /></Button>
                <span className="tabular font-bold">{cart[i.id]}</span>
              </>}
              <Button size="icon" variant="electric" onClick={() => add(i.id, 1)} aria-label={`Add ${i.name}`}><Plus /></Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-4 rounded-2xl border bg-card p-4 shadow-card">
        <h2 className="font-bold">Your visit</h2>
        {([["name", "Full name", "text"], ["phone", "Phone", "tel"], ["email", "Email", "email"], ["size", "Party size", "number"], ["date", "Date", "date"], ["time", "Arrival time", "time"]] as const).map(([k, l, t]) => (
          <div key={k} className="space-y-1.5">
            <Label>{l}</Label>
            <Input type={t} value={f[k]} onChange={set(k)} required={["name", "phone", "size", "date", "time"].includes(k)} min={t === "number" ? 1 : undefined} max={t === "number" ? 30 : undefined} />
          </div>
        ))}
        <div className="space-y-1.5">
          <Label>Notes for the kitchen</Label>
          <Input value={f.notes} onChange={set("notes")} placeholder="Allergies, dietary needs…" />
        </div>
      </div>

      <div className="mt-6 space-y-3 rounded-2xl border bg-card p-4 shadow-card">
        <h2 className="font-bold">Payment</h2>
        <div className="flex gap-2">
          {([["card", "Card", <CreditCard key="c" className="h-4 w-4" />], ["apple_pay", "Apple Pay", <ShieldCheck key="a" className="h-4 w-4" />]] as const).map(([v, l, icon]) => (
            <button key={v} onClick={() => setPay(v)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${pay === v ? "border-electric bg-electric/10 text-electric" : "text-muted-foreground"}`}>{icon}{l}</button>
          ))}
        </div>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Food total (incl. tax & service)</dt><dd className="tabular">{money(withTax, cur)}</dd></div>
          <div className="flex justify-between font-semibold"><dt>Deposit due now ({ag.deposit_pct}%)</dt><dd className="tabular text-electric">{money(deposit, cur)}</dd></div>
          <div className="flex justify-between text-xs text-muted-foreground"><dt>Payable at the restaurant</dt><dd className="tabular">{money(withTax - deposit, cur)}</dd></div>
        </dl>
        <Button variant="electric" size="xl" className="w-full" disabled={!canSubmit || busy} onClick={submit}>
          {busy ? "Processing…" : `Pay ${money(deposit, cur)} deposit · ${pay === "card" ? "Card" : "Apple Pay"}`}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">Demo payment capture — no card is charged. Deposit is non-refundable once kitchen preparation begins.</p>
      </div>
    </div>
  );
}

type TrackData = {
  status: string;
  customer_name: string;
  booking_date: string;
  arrival_time: string;
  eta_time: string | null;
  eta_change_count: number;
  is_proximity_verified: boolean;
  pre_order_paid_amount: number;
  order_number: number | null;
  order_status: string | null;
  order_total: number | null;
  order_items: { name: string; quantity: number; status: string }[];
};

function Track({ rid, reservationId, cur }: { rid: string; reservationId: string; cur: string }) {
  const qc = useQueryClient();
  const [locating, setLocating] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ["guest-track", reservationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("guest_track", { _reservation_id: reservationId });
      if (error) throw error;
      return data as TrackData;
    },
    refetchInterval: 15000,
  });
  useEffect(() => {
    const t = setInterval(() => qc.invalidateQueries({ queryKey: ["guest-track", reservationId] }), 15000);
    return () => clearInterval(t);
  }, [qc, reservationId]);

  async function pushEta() {
    const current = q.data?.eta_time ? new Date(q.data.eta_time) : new Date(`${q.data?.booking_date}T${q.data?.arrival_time}`);
    const next = new Date(Math.min(current.getTime() + 15 * 60000, Date.now() + 15 * 60000));
    const { error } = await supabase.rpc("guest_update_eta", { _reservation_id: reservationId, _new_eta: next.toISOString() });
    if (error) { toast.error(error.message); return; }
    toast.success("Restaurant notified — arriving 15 minutes later");
    qc.invalidateQueries({ queryKey: ["guest-track", reservationId] });
  }

  function verifyNearby() {
    if (!navigator.geolocation) { toast.error("Location sharing is not available on this device"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const km = distanceKm(pos.coords.latitude, pos.coords.longitude, RESTAURANT_COORDS.lat, RESTAURANT_COORDS.lng);
        setDistance(km);
        if (km > 2) {
          setLocating(false);
          toast.error(`You are ${km.toFixed(1)}km away — you need to be within 2km of the restaurant`);
          return;
        }
        supabase.rpc("guest_verify_proximity", { _reservation_id: reservationId, _lat: pos.coords.latitude, _lng: pos.coords.longitude })
          .then(({ error }) => {
            setLocating(false);
            if (error) toast.error(error.message);
            else { toast.success("Thanks! The kitchen has been notified you're nearby"); qc.invalidateQueries({ queryKey: ["guest-track", reservationId] }); }
          });
      },
      () => { setLocating(false); toast.error("We couldn't access your location — check browser permissions"); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  if (q.isLoading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading your booking…</div>;
  if (q.isError || !q.data) return <div className="p-8 text-center text-muted-foreground">We couldn't find that booking. Check your link and try again.</div>;
  const d = q.data;
  const eta = d.eta_time ? new Date(d.eta_time) : new Date(`${d.booking_date}T${d.arrival_time}`);
  const canChangeEta = d.eta_change_count < 1;
  const steps = ["incoming", "accepted", "preparing", "ready", "served"];
  const stepIdx = Math.max(0, steps.indexOf(d.order_status ?? "incoming"));

  return (
    <div className="space-y-5 p-4">
      <div className="rounded-2xl border bg-card p-5 text-center shadow-card">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <h2 className="mt-2 text-lg font-bold">Hi {d.customer_name.split(" ")[0]}, you're booked in</h2>
        <p className="tabular text-sm text-muted-foreground">{d.booking_date} · arrival {d.arrival_time.slice(0, 5)}</p>
        <div className="tabular mt-4 text-3xl font-bold text-electric">{eta.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}</div>
        <p className="text-xs text-muted-foreground">Live arrival ETA</p>
        {canChangeEta
          ? <Button variant="outline" className="mt-3" onClick={pushEta}>Running late? Push ETA +15 min</Button>
          : <p className="mt-3 text-xs text-muted-foreground">You've used your one ETA change.</p>}
      </div>

      <div className={`rounded-2xl border p-4 shadow-card ${d.is_proximity_verified ? "border-success/50 bg-success/10" : "bg-card"}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-semibold"><MapPin className="h-4 w-4 text-electric" />Proximity check</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {d.is_proximity_verified
                ? distance != null ? `Verified — you're ${distance.toFixed(1)}km away. Your food will be timed to your arrival.` : "Verified — your food will be timed to your arrival."
                : "Share your location when you're within 2km so the kitchen starts at the right moment."}
            </p>
          </div>
          {!d.is_proximity_verified && <Button variant="electric" onClick={verifyNearby} disabled={locating}>{locating ? "Locating…" : "Verify I'm Nearby"}</Button>}
        </div>
      </div>

      {d.order_number != null && (
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">Pre-order #{d.order_number}</h2>
            <span className="tabular text-sm text-muted-foreground">{money(d.order_total ?? 0, cur)}</span>
          </div>
          <div className="mt-4 flex items-center gap-1">
            {steps.map((s, i) => (
              <div key={s} className="flex flex-1 flex-col items-center gap-1">
                <div className={`h-1.5 w-full rounded-full ${i <= stepIdx ? "bg-electric" : "bg-muted"}`} />
                <span className={`text-[10px] capitalize ${i <= stepIdx ? "text-foreground" : "text-muted-foreground"}`}>{s === "incoming" ? "Received" : s}</span>
              </div>
            ))}
          </div>
          <ul className="mt-4 space-y-1 text-sm">
            {d.order_items.map((i, ix) => <li key={ix} className="flex justify-between"><span>{i.quantity}× {i.name}</span><span className="text-xs capitalize text-muted-foreground">{i.status}</span></li>)}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Deposit paid: <span className="tabular font-semibold text-success">{money(d.pre_order_paid_amount, cur)}</span> — non-refundable once kitchen preparation begins.</p>
        </div>
      )}
    </div>
  );
}

function BookForm({ rid }: { rid: string }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", size: "2", date: new Date().toISOString().slice(0, 10), time: "19:00", req: "", diet: "" });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("reservations").insert({
      restaurant_id: rid, customer_name: f.name, customer_phone: f.phone, customer_email: f.email,
      party_size: Number(f.size), booking_date: f.date, arrival_time: f.time, special_requests: f.req || null, dietary_notes: f.diet || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setDone(true);
  }

  if (done) return <div className="p-8 text-center"><h2 className="text-xl font-bold">Request received</h2><p className="mt-2 text-muted-foreground">The restaurant will confirm your booking shortly.</p></div>;
  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      {([["name", "Full name", "text"], ["phone", "Phone", "tel"], ["email", "Email", "email"], ["size", "Party size", "number"], ["date", "Date", "date"], ["time", "Arrival time", "time"], ["req", "Special requests", "text"], ["diet", "Dietary notes", "text"]] as const).map(([k, l, t]) => (
        <div key={k} className="space-y-1.5">
          <Label>{l}</Label>
          <Input type={t} value={f[k]} onChange={set(k)} required={["name", "phone", "size", "date", "time"].includes(k)} min={t === "number" ? 1 : undefined} max={t === "number" ? 30 : undefined} />
        </div>
      ))}
      <Button type="submit" variant="electric" size="xl" className="w-full" disabled={busy}>Request booking</Button>
    </form>
  );
}
