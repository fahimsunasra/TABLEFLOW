import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Protected operations suite: session lives in the browser, so gate client-side only.
export const Route = createFileRoute("/app")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [{ title: "TABLEFLOW Operations" }, { name: "robots", content: "noindex" }] }),
  component: () => <Outlet />,
});
