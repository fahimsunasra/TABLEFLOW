import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChefHat, LayoutDashboard, LogOut, TabletSmartphone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGate } from "@/components/tf/RoleGate";
import { Logo } from "@/components/tf/Logo";
import { OWNER_SECTIONS } from "@/lib/owner-sections";



export const Route = createFileRoute("/app/owner")({ component: OwnerLayout });

const navCls = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
const activeCls = { className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" };

function OwnerLayout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <RoleGate area="owner">
      {(m) => (
        <div className="flex min-h-screen">
          <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-1 overflow-y-auto bg-sidebar p-4">
            <div className="mb-4 px-1"><Logo inverted /></div>
            <div className="mb-3 rounded-lg bg-sidebar-accent px-3 py-2">
              <div className="text-sm font-semibold text-sidebar-accent-foreground">{m.restaurants.name}</div>
              <div className="text-xs capitalize text-sidebar-foreground">{m.role} · {m.restaurants.subscription_tier}</div>
            </div>
            <Link to="/app/owner" activeOptions={{ exact: true }} className={navCls} activeProps={activeCls}><LayoutDashboard className="h-4 w-4" />Overview</Link>
            {OWNER_SECTIONS.map((s) => (
              <Link key={s.slug} to="/app/owner/$section" params={{ section: s.slug }} className={navCls} activeProps={activeCls}>
                <s.icon className="h-4 w-4" />{s.label}
              </Link>
            ))}
            <div className="my-2 h-px bg-sidebar-border" />
            <Link to="/app/foh" className={navCls}><TabletSmartphone className="h-4 w-4" />FOH Tablet</Link>
            <Link to="/app/kds" className={navCls}><ChefHat className="h-4 w-4" />Kitchen Display</Link>
            <button onClick={signOut} className={`${navCls} mt-auto`}><LogOut className="h-4 w-4" />Sign out</button>
          </aside>
          <main className="min-w-0 flex-1 p-8"><Outlet /></main>
        </div>
      )}
    </RoleGate>
  );
}
