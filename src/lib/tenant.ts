import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type StaffRole = Database["public"]["Enums"]["staff_role"];
export type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
export type Membership = Database["public"]["Tables"]["staff_members"]["Row"] & {
  restaurants: Restaurant;
};

/** Which roles may open each area of the operations suite. */
export const AREA_ROLES: Record<"owner" | "foh" | "kds", StaffRole[]> = {
  owner: ["owner", "manager"],
  foh: ["owner", "manager", "foh"],
  kds: ["owner", "manager", "kitchen"],
};

export function canAccess(role: StaffRole | undefined, area: keyof typeof AREA_ROLES) {
  return !!role && AREA_ROLES[area].includes(role);
}

export function homeFor(role: StaffRole) {
  if (role === "kitchen") return "/app/kds" as const;
  if (role === "foh") return "/app/foh" as const;
  return "/app/owner" as const;
}

export const membershipQuery = {
  queryKey: ["membership"],
  queryFn: async (): Promise<Membership | null> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data, error } = await supabase
      .from("staff_members")
      .select("*, restaurants(*)")
      .eq("user_id", u.user.id)
      .eq("is_active", true)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as Membership) ?? null;
  },
};

export function useMembership() {
  return useQuery(membershipQuery);
}

export function money(n: number | string | null | undefined, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(Number(n ?? 0));
}

export type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

export function settingsOf(r: Restaurant): Record<string, unknown> {
  const s = r.settings_json;
  return s && typeof s === "object" && !Array.isArray(s) ? (s as Record<string, unknown>) : {};
}
