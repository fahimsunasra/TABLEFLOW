import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMembership, membershipQuery } from "@/lib/tenant";
import { Logo } from "@/components/tf/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  head: () => ({
    meta: [
      { title: "Set up your restaurant — TABLEFLOW" },
      { name: "description", content: "Six quick steps to get your restaurant live on TABLEFLOW." },
      { property: "og:title", content: "Restaurant setup — TABLEFLOW" },
      { property: "og:description", content: "Six quick steps to go live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Onboarding,
});

const STEPS = ["Restaurant Info", "Operating Hours", "Table Floor Setup", "Menu Categories", "Payment Setup", "Staff Invites"];
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function Onboarding() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: m } = useMembership();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState({ name: "", slug: "", address: "", currency: "AUD", tax: "10", owner: "" });
  const [hours, setHours] = useState<Record<string, string>>(Object.fromEntries(DAYS.map((d) => [d, "12:00-22:00"])));
  const [zones, setZones] = useState({ "Main Dining": 6, Patio: 4, Bar: 2 });
  const [cats, setCats] = useState("Starters, Mains, Desserts, Drinks");
  const [pay, setPay] = useState({ service: "0", stripe: "" });
  const [invites, setInvites] = useState("");

  const rid = m?.restaurant_id;
  const refresh = () => qc.invalidateQueries({ queryKey: membershipQuery.queryKey });

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      if (step < STEPS.length - 1) setStep(step + 1);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const settings = () => (m?.restaurants.settings_json as Record<string, unknown>) ?? {};

  const save = [
    async () => {
      if (rid) return;
      const { error } = await supabase.rpc("create_restaurant", { _name: info.name, _slug: info.slug || slugify(info.name), _full_name: info.owner });
      if (error) throw error;
      await refresh();
      const fresh = await qc.fetchQuery(membershipQuery);
      await supabase.from("restaurants").update({ address: info.address, currency: info.currency, tax_rate: Number(info.tax) }).eq("id", fresh!.restaurant_id);
    },
    async () => {
      const { error } = await supabase.from("restaurants").update({ settings_json: { ...settings(), hours } }).eq("id", rid!);
      if (error) throw error;
    },
    async () => {
      let n = 1;
      const rows = Object.entries(zones).flatMap(([zone, count], zi) =>
        Array.from({ length: count }, (_, i) => ({
          restaurant_id: rid!, table_number: `T-${String(n++).padStart(2, "0")}`,
          zone: zone as "Main Dining", capacity: 4, pos_x: 40 + (i % 6) * 170, pos_y: 40 + (zi * 2 + Math.floor(i / 6)) * 150,
        })),
      );
      const { error } = await supabase.from("tables").upsert(rows, { onConflict: "restaurant_id,table_number" });
      if (error) throw error;
    },
    async () => {
      const rows = cats.split(",").map((c) => c.trim()).filter(Boolean).map((name, i) => ({ restaurant_id: rid!, name, sort_order: i + 1 }));
      const { error } = await supabase.from("menu_categories").insert(rows);
      if (error) throw error;
    },
    async () => {
      const { error } = await supabase.from("restaurants").update({ service_charge_pct: Number(pay.service), stripe_account_id: pay.stripe || null }).eq("id", rid!);
      if (error) throw error;
    },
    async () => {
      const list = invites.split("\n").map((l) => l.split(",").map((s) => s.trim())).filter((p) => p[0]);
      if (list.length) {
        const { error } = await supabase.from("staff_members").insert(
          list.map(([email = "", role = "foh"]) => ({ restaurant_id: rid!, full_name: email.split("@")[0] ?? email, email, role: (["manager", "foh", "kitchen"].includes(role) ? role : "foh") as "foh", is_active: true })),
        );
        if (error) throw error;
      }
      await supabase.from("restaurants").update({ settings_json: { ...settings(), onboarding_complete: true } }).eq("id", rid!);
      await refresh();
      toast.success("You're live!");
      navigate({ to: "/app/owner" });
    },
  ];

  async function claimDemo() {
    setBusy(true);
    const { error } = await supabase.rpc("claim_demo_restaurant");
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await refresh();
    navigate({ to: "/app/owner" });
  }

  return (
    <div className="min-h-screen bg-hero">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Logo />
        {!rid && <Button variant="outline" onClick={claimDemo} disabled={busy}>Explore the Bistro Aura demo</Button>}
      </header>
      <main className="mx-auto grid max-w-5xl gap-8 px-6 pb-16 md:grid-cols-[220px_1fr]">
        <ol className="space-y-1">
          {STEPS.map((s, i) => (
            <li key={s} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${i === step ? "bg-card font-semibold shadow-card" : "text-muted-foreground"}`}>
              <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${i < step ? "bg-success text-success-foreground" : i === step ? "bg-electric text-electric-foreground" : "bg-muted"}`}>
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <section className="rounded-2xl border bg-card p-8 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wider text-electric">Step {step + 1} of 6</p>
          <h1 className="mt-1 text-2xl font-bold">{STEPS[step]}</h1>
          <div className="mt-6 space-y-4">
            {step === 0 && (rid ? <p className="text-muted-foreground">{m?.restaurants.name} is already created — continue.</p> : (
              <div className="grid gap-4 sm:grid-cols-2">
                <F label="Restaurant name" v={info.name} on={(v) => setInfo({ ...info, name: v, slug: slugify(v) })} />
                <F label="Guest URL slug" v={info.slug} on={(v) => setInfo({ ...info, slug: slugify(v) })} />
                <F label="Your name" v={info.owner} on={(v) => setInfo({ ...info, owner: v })} />
                <F label="Address" v={info.address} on={(v) => setInfo({ ...info, address: v })} />
                <F label="Currency" v={info.currency} on={(v) => setInfo({ ...info, currency: v.toUpperCase().slice(0, 3) })} />
                <F label="Tax rate %" v={info.tax} on={(v) => setInfo({ ...info, tax: v })} />
              </div>
            ))}
            {step === 1 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {DAYS.map((d) => <F key={d} label={d.toUpperCase()} v={hours[d] ?? ""} on={(v) => setHours({ ...hours, [d]: v })} />)}
              </div>
            )}
            {step === 2 && (
              <div className="grid gap-4 sm:grid-cols-3">
                {Object.entries(zones).map(([z, n]) => (
                  <F key={z} label={`${z} tables`} v={String(n)} on={(v) => setZones({ ...zones, [z]: Math.max(0, Math.min(40, Number(v) || 0)) })} />
                ))}
              </div>
            )}
            {step === 3 && <F label="Categories (comma separated)" v={cats} on={setCats} />}
            {step === 4 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <F label="Service charge %" v={pay.service} on={(v) => setPay({ ...pay, service: v })} />
                <F label="Stripe account ID (optional)" v={pay.stripe} on={(v) => setPay({ ...pay, stripe: v })} />
              </div>
            )}
            {step === 5 && (
              <div className="space-y-1.5">
                <Label>One per line: email, role (manager / foh / kitchen)</Label>
                <textarea className="min-h-32 w-full rounded-md border bg-background p-3 text-sm" value={invites} onChange={(e) => setInvites(e.target.value)} placeholder={"sam@bistro.com, foh\nchef@bistro.com, kitchen"} />
              </div>
            )}
          </div>
          <div className="mt-8 flex justify-between">
            <Button variant="ghost" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>Back</Button>
            <Button variant="electric" disabled={busy || (step === 0 && !rid && !info.name)} onClick={() => run(save[step]!)}>
              {step === 5 ? "Finish setup" : "Save & continue"}
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

function F({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
