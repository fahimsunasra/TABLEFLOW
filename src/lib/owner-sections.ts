import {
  BarChart3, Bell, CalendarDays, ChefHat, Contact, Crown, Gift, LayoutDashboard, LayoutGrid, Megaphone, Plug,
  QrCode, Receipt, Settings, TabletSmartphone, Users, UtensilsCrossed, Wallet,
} from "lucide-react";

/** Generic sections rendered by /app/owner/$section. */
export const OWNER_SECTIONS = [
  { slug: "orders", label: "Orders", icon: Receipt },
  { slug: "qr-codes", label: "QR Code Management", icon: QrCode },
  { slug: "menu", label: "Menu Management", icon: UtensilsCrossed },
  { slug: "promotions", label: "Promotions & Discounts", icon: Megaphone },
  { slug: "crm", label: "Customers / CRM", icon: Contact },
  { slug: "loyalty", label: "Loyalty & Rewards", icon: Gift },
  { slug: "billing", label: "Billing & Payments", icon: Wallet },
  { slug: "analytics", label: "Analytics & Reports", icon: BarChart3 },
  { slug: "staff", label: "Staff Management", icon: Users },
  { slug: "integrations", label: "Integrations", icon: Plug },
  { slug: "notifications", label: "Notifications", icon: Bell },
  { slug: "settings", label: "Settings", icon: Settings },
  { slug: "subscription", label: "Subscription & Billing", icon: Crown },
] as const;

type Icon = typeof Receipt;
export type NavItem =
  | { kind: "route"; label: string; icon: Icon; to: "/app/owner/overview" | "/app/owner/reservations" | "/app/owner/floor" | "/app/kds" | "/app/foh" }
  | { kind: "section"; label: string; icon: Icon; slug: (typeof OWNER_SECTIONS)[number]["slug"] };

const s = (slug: (typeof OWNER_SECTIONS)[number]["slug"]): NavItem => {
  const x = OWNER_SECTIONS.find((o) => o.slug === slug)!;
  return { kind: "section", label: x.label, icon: x.icon, slug };
};

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  { title: "Operations", items: [
    { kind: "route", label: "Overview", icon: LayoutDashboard, to: "/app/owner/overview" },
    { kind: "route", label: "Reservations", icon: CalendarDays, to: "/app/owner/reservations" },
    { kind: "route", label: "Floor Management", icon: LayoutGrid, to: "/app/owner/floor" },
    s("orders"),
    { kind: "route", label: "Kitchen", icon: ChefHat, to: "/app/kds" },
    { kind: "route", label: "FOH View", icon: TabletSmartphone, to: "/app/foh" },
  ] },
  { title: "Guest Experience", items: [s("qr-codes"), s("menu"), s("promotions"), s("crm"), s("loyalty")] },
  { title: "Business", items: [s("billing"), s("analytics"), s("staff"), s("integrations")] },
  { title: "System", items: [s("notifications"), s("settings"), s("subscription")] },
];
