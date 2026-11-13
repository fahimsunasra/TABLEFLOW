import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Search = { table?: string | undefined; mode?: "book" | undefined };

export const Route = createFileRoute("/guest/$restaurantSlug")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    table: typeof s["table"] === "string" ? s["table"] : undefined,
    mode: s["mode"] === "book" ? "book" : undefined,
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

function Guest() {
  const { restaurantSlug } = Route.useParams();
  const { table, mode } = Route.useSearch();
  const q = useQuery({
    queryKey: ["guest", restaurantSlug],
    queryFn: async () => {
      const { data: r, error } = await supabase.from("restaurants").select("id,name,slug,address,currency,tax_rate,service_charge_pct").eq("slug", restaurantSlug).maybeSingle();
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

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-32">
      <header className="bg-navy px-5 pb-6 pt-8 text-primary-foreground">
        <p className="text-xs uppercase tracking-widest opacity-70">{table ? `Table ${table}` : mode === "book" ? "Online booking" : "Menu"}</p>
        <h1 className="mt-1 text-3xl font-bold">{r.name}</h1>
        <p className="text-sm opacity-70">{r.address}</p>
      </header>
      {mode === "book" ? <BookForm rid={r.id} /> : <MenuOrder data={q.data} table={table} />}
      <p className="mt-10 text-center text-xs text-muted-foreground">Powered by TABLEFLOW</p>
    </div>
  );
}

type GuestData = NonNullable<ReturnType<typeof useQuery<unknown>>["data"]> & {
  r: { slug: string; currency: string; tax_rate: number; service_charge_pct: number };
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
      <nav className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b bg-background/95 px-4 py-3 backdrop-blur">
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
