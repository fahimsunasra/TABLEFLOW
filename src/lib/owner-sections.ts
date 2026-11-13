import {
  BarChart3, CalendarDays, Crown, Gift, LayoutGrid, Megaphone, Plug, QrCode, Receipt, Settings, Users,
  UtensilsCrossed, Wallet, Contact,
} from "lucide-react";

export const OWNER_SECTIONS = [
  { slug: "reservations", label: "Reservations", icon: CalendarDays },
  { slug: "floor-plan", label: "Floor Plan", icon: LayoutGrid },
  { slug: "orders", label: "Orders", icon: Receipt },
  { slug: "qr-codes", label: "QR Codes", icon: QrCode },
  { slug: "menu", label: "Menu", icon: UtensilsCrossed },
  { slug: "promotions", label: "Promotions", icon: Megaphone },
  { slug: "crm", label: "CRM", icon: Contact },
  { slug: "loyalty", label: "Loyalty", icon: Gift },
  { slug: "billing", label: "Billing", icon: Wallet },
  { slug: "analytics", label: "Analytics", icon: BarChart3 },
  { slug: "staff", label: "Staff", icon: Users },
  { slug: "integrations", label: "Integrations", icon: Plug },
  { slug: "settings", label: "Settings", icon: Settings },
  { slug: "subscription", label: "Subscription", icon: Crown },
] as const;
