import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, ChefHat, LayoutGrid, QrCode, Sparkles, TabletSmartphone } from "lucide-react";
import { Logo } from "@/components/tf/Logo";
import { AuthCard } from "@/components/tf/AuthCard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TABLEFLOW — One Platform. Complete Restaurant Operations." },
      { name: "description", content: "Reservations, floor plan, QR ordering, kitchen display and CRM for restaurants in one platform." },
      { property: "og:title", content: "TABLEFLOW — Complete Restaurant Operations" },
      { property: "og:description", content: "Reservations, floor plan, QR ordering, kitchen display and CRM in one platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: CalendarCheck, title: "Reservations & ETA", text: "Online booking, deposits and live arrival tracking." },
  { icon: LayoutGrid, title: "Live floor plan", text: "Every table's status, in real time, across zones." },
  { icon: QrCode, title: "QR table ordering", text: "Guests order and pay from their phone — no app needed." },
  { icon: ChefHat, title: "Kitchen Display", text: "Station-routed tickets with live timers." },
  { icon: TabletSmartphone, title: "Front of House", text: "A tablet console built for busy service." },
  { icon: Sparkles, title: "Loyalty & promotions", text: "CRM, rewards and secret QR-exclusive deals." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost"><Link to="/guest/$restaurantSlug" params={{ restaurantSlug: "bistro-aura" }} search={{ table: "T-04" }}>Guest demo</Link></Button>
          <Button asChild variant="default"><Link to="/auth">Sign in</Link></Button>
        </nav>
      </header>

      <section className="bg-hero">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-success" /> Built for multi-venue restaurant groups
            </span>
            <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight text-foreground md:text-6xl">
              One Platform.<br /><span className="text-electric">Complete Restaurant</span> Operations.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              From the first booking to the final bill — reservations, floor, kitchen and guests stay in sync, live.
            </p>
            <div className="mt-8 grid max-w-md grid-cols-3 gap-3">
              {[["12", "tables live"], ["3.2m", "avg ticket time"], ["+18%", "covers / night"]].map(([n, l]) => (
                <div key={l} className="rounded-xl border bg-card p-3 shadow-card">
                  <div className="tabular text-xl font-bold text-foreground">{n}</div>
                  <div className="text-xs text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div id="auth"><AuthCard /></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-3xl font-bold tracking-tight">Everything service needs, nothing it doesn't.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-card">
              <f.icon className="h-6 w-6 text-electric" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">© 2026 TABLEFLOW</footer>
    </div>
  );
}
