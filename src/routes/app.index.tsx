import { createFileRoute, Navigate } from "@tanstack/react-router";
import { homeFor, useMembership } from "@/lib/tenant";

export const Route = createFileRoute("/app/")({ component: AppHome });

function AppHome() {
  const { data: m, isLoading } = useMembership();
  if (isLoading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading workspace…</div>;
  if (!m) return <Navigate to="/onboarding" />;
  return <Navigate to={homeFor(m.role)} />;
}
