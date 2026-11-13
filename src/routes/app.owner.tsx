import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, ChevronsUpDown, LogOut, MapPin, PanelLeftClose, PanelLeftOpen, Search, Settings, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGate } from "@/components/tf/RoleGate";
import { Logo } from "@/components/tf/Logo";
import { ActivityList } from "@/components/tf/ActivityList";
import { NAV_GROUPS, type NavItem } from "@/lib/owner-sections";
import { DateRangeContext, PRESETS, rangeFor, ymd, type Preset } from "@/lib/date-range";
import { kitchenLoad } from "@/lib/preorder";
import { useLiveTables } from "@/lib/realtime";
import { settingsOf, type Membership } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export const Route = createFileRoute("/app/owner")({ component: () => <RoleGate area="owner">{(m) => <Shell m={m} />}</RoleGate> });

const navCls = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
const activeProps = { className: "bg-sidebar-accent !text-sidebar-accent-foreground font-medium" };

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const inner = <><item.icon className="h-4 w-4 shrink-0" />{!collapsed && <span className="truncate">{item.label}</span>}</>;
  if (item.kind === "section")
    return <Link to="/app/owner/$section" params={{ section: item.slug }} className={navCls} activeProps={activeProps} title={item.label}>{inner}</Link>;
  return <Link to={item.to} className={navCls} activeProps={activeProps} title={item.label}>{inner}</Link>;
}

function Shell({ m }: { m: Membership }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [preset, setPreset] = useState<Preset>("today");
  const [custom, setCustom] = useState<{ from: Date; to: Date } | undefined>();
  const [bell, setBell] = useState(false);
  const [cmd, setCmd] = useState(false);
  const range = useMemo(() => rangeFor(preset, new Date(), custom), [preset, custom]);
  const location = String(settingsOf(m.restaurants)["location_label"] ?? "Downtown");

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1279px)");
    setCollapsed(mq.matches);
    const on = (e: MediaQueryListEvent) => setCollapsed(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((v) => !v); } };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <DateRangeContext.Provider value={{ preset, setPreset, from: range.from, to: range.to, setCustom }}>
      <div className="flex min-h-screen w-full">
        <aside className={`sticky top-0 flex h-screen shrink-0 flex-col bg-sidebar transition-[width] ${collapsed ? "w-16" : "w-65"}`}>
          <div className={`flex items-center p-4 ${collapsed ? "justify-center" : "justify-between"}`}>
            {!collapsed && <Logo inverted />}
            <button onClick={() => setCollapsed(!collapsed)} className="rounded-md p-1.5 text-sidebar-foreground hover:bg-sidebar-accent" aria-label="Toggle sidebar">
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
          <div className="px-3">
            <DropdownMenu>
              <DropdownMenuTrigger className={`flex w-full items-center gap-2 rounded-lg bg-sidebar-accent p-2 text-left ${collapsed ? "justify-center" : ""}`}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-electric text-sm font-bold text-electric-foreground">{m.restaurants.name[0]}</span>
                {!collapsed && <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-sidebar-accent-foreground">{m.restaurants.name} — {location}</span>
                    <span className="block text-xs capitalize text-sidebar-foreground">{m.restaurants.subscription_tier} plan</span>
                  </span>
                  <ChevronsUpDown className="h-4 w-4 text-sidebar-foreground" />
                </>}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60">
                <DropdownMenuLabel>Locations</DropdownMenuLabel>
                <DropdownMenuItem><MapPin className="h-4 w-4" />{m.restaurants.name} — {location}<Check className="ml-auto h-4 w-4" /></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>Add another location (soon)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <nav className="mt-3 flex-1 space-y-4 overflow-y-auto px-3 pb-4">
            {NAV_GROUPS.map((g) => (
              <div key={g.title} className="space-y-0.5">
                {!collapsed ? <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">{g.title}</div> : <div className="mx-3 mb-1 h-px bg-sidebar-border" />}
                {g.items.map((i) => <NavLink key={i.label} item={i} collapsed={collapsed} />)}
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-card/90 px-6 py-3 backdrop-blur">
            <button onClick={() => setCmd(true)} className="flex h-9 w-64 items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground hover:border-electric/40">
              <Search className="h-4 w-4" /> Search…<kbd className="tabular ml-auto rounded border bg-muted px-1.5 text-[10px]">⌘K</kbd>
            </button>
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              {PRESETS.map((p) => (
                <button key={p.value} onClick={() => setPreset(p.value)} className={`rounded-md px-3 py-1 text-xs font-medium ${preset === p.value ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"}`}>{p.label}</button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="flex items-center gap-1 text-xs">
                <input type="date" className="rounded-md border bg-background px-2 py-1" defaultValue={ymd(range.from)} onChange={(e) => e.target.value && setCustom({ from: new Date(e.target.value + "T00:00"), to: custom?.to ?? new Date() })} />
                <span>→</span>
                <input type="date" className="rounded-md border bg-background px-2 py-1" defaultValue={ymd(new Date(range.to.getTime() - 86400000))} onChange={(e) => e.target.value && setCustom({ from: custom?.from ?? range.from, to: new Date(e.target.value + "T00:00") })} />
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <KitchenPill rid={m.restaurant_id} />
              <Button variant="ghost" size="icon" onClick={() => setBell(true)} aria-label="Notifications"><Bell /></Button>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-0.5 hover:bg-muted" aria-label="Profile menu">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-navy text-xs font-semibold text-primary-foreground">
                    {m.full_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel><div>{m.full_name}</div><div className="text-xs font-normal capitalize text-muted-foreground">{m.role} · {m.email}</div></DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate({ to: "/app/owner/$section", params: { section: "settings" } })}><Settings className="h-4 w-4" />Settings</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/app/owner/$section", params: { section: "staff" } })}><User className="h-4 w-4" />Staff</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}><LogOut className="h-4 w-4" />Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="min-w-0 flex-1 p-6 lg:p-8"><Outlet /></main>
        </div>
      </div>

      <Sheet open={bell} onOpenChange={setBell}>
        <SheetContent className="w-96 overflow-y-auto">
          <SheetHeader><SheetTitle>Notifications</SheetTitle></SheetHeader>
          <div className="mt-4"><ActivityList rid={m.restaurant_id} /></div>
        </SheetContent>
      </Sheet>
      <GlobalSearch open={cmd} setOpen={setCmd} rid={m.restaurant_id} />
    </DateRangeContext.Provider>
  );
}

function KitchenPill({ rid }: { rid: string }) {
  const q = useQuery({
    queryKey: ["kitchen-load", rid],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("created_at").eq("restaurant_id", rid).in("status", ["accepted", "preparing"]);
      const rows = data ?? [];
      const avg = rows.length ? rows.reduce((s, o) => s + (Date.now() - new Date(o.created_at).getTime()) / 60000, 0) / rows.length : 0;
      return { avg: Math.round(avg), n: rows.length };
    },
    refetchInterval: 60000,
  });
  useLiveTables(rid, ["orders"], [["kitchen-load", rid]]);
  const load = kitchenLoad(q.data?.avg ?? 0, q.data?.n ?? 0);
  const tone = load === "Busy" ? "bg-destructive/10 text-destructive" : load === "Moderate" ? "bg-warning/15 text-warning-foreground" : "bg-success/10 text-success";
  return (
    <Link to="/app/kds" className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${tone}`}>
      <span className="h-2 w-2 animate-pulse rounded-full bg-current" />{load} • <span className="tabular">{q.data?.avg ?? 0}m</span> avg prep
    </Link>
  );
}

function GlobalSearch({ open, setOpen, rid }: { open: boolean; setOpen: (v: boolean) => void; rid: string }) {
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["search-index", rid],
    enabled: open,
    queryFn: async () => {
      const [r, c, i] = await Promise.all([
        supabase.from("reservations").select("id,customer_name,booking_date,arrival_time").eq("restaurant_id", rid).order("booking_date", { ascending: false }).limit(50),
        supabase.from("customers").select("id,full_name,phone").eq("restaurant_id", rid).limit(50),
        supabase.from("menu_items").select("id,name").eq("restaurant_id", rid),
      ]);
      return { res: r.data ?? [], cust: c.data ?? [], items: i.data ?? [] };
    },
  });
  const go = (fn: () => void) => { setOpen(false); fn(); };
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, guests, bookings, dishes…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Pages">
          {NAV_GROUPS.flatMap((g) => g.items).map((i) => (
            <CommandItem key={i.label} onSelect={() => go(() => i.kind === "section" ? navigate({ to: "/app/owner/$section", params: { section: i.slug } }) : navigate({ to: i.to }))}>
              <i.icon className="h-4 w-4" />{i.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Reservations">
          {q.data?.res.map((r) => (
            <CommandItem key={r.id} value={`res ${r.customer_name} ${r.booking_date}`} onSelect={() => go(() => navigate({ to: "/app/owner/reservations", search: { id: r.id } }))}>
              {r.customer_name}<span className="tabular ml-auto text-xs text-muted-foreground">{r.booking_date} {r.arrival_time.slice(0, 5)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Customers">
          {q.data?.cust.map((c) => (
            <CommandItem key={c.id} value={`cust ${c.full_name} ${c.phone ?? ""}`} onSelect={() => go(() => navigate({ to: "/app/owner/$section", params: { section: "crm" } }))}>{c.full_name}</CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Menu">
          {q.data?.items.map((i) => (
            <CommandItem key={i.id} value={`menu ${i.name}`} onSelect={() => go(() => navigate({ to: "/app/owner/$section", params: { section: "menu" } }))}>{i.name}</CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
