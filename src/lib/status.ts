export const TABLE_STATUS_CLASS: Record<string, string> = {
  available: "border-success/40 bg-success/10 text-success",
  reserved: "border-electric/40 bg-electric/10 text-electric",
  occupied: "border-navy/30 bg-navy/10 text-foreground",
  waiting_food: "border-warning/50 bg-warning/15 text-warning-foreground",
  bill_requested: "border-destructive/40 bg-destructive/10 text-destructive",
  cleaning: "border-border bg-muted text-muted-foreground",
};
export const TABLE_STATUSES = Object.keys(TABLE_STATUS_CLASS);
export const label = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
