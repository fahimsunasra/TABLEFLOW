import type { ReactNode } from "react";
import { Link, Navigate } from "@tanstack/react-router";
import { canAccess, useMembership, type AREA_ROLES, type Membership } from "@/lib/tenant";
import { Button } from "@/components/ui/button";

export function RoleGate({ area, children }: { area: keyof typeof AREA_ROLES; children: (m: Membership) => ReactNode }) {
  const { data: m, isLoading } = useMembership();
  if (isLoading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  if (!m) return <Navigate to="/onboarding" />;
  if (!canAccess(m.role, area))
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">No access</h1>
          <p className="mt-2 text-muted-foreground">Your role ({m.role}) can't open this area.</p>
          <Button asChild className="mt-4"><Link to="/app">Go to my workspace</Link></Button>
        </div>
      </div>
    );
  return <>{children(m)}</>;
}
