import { CalendarDays, Receipt } from "lucide-react";
import { ago, useActivityFeed } from "@/lib/activity";

export function ActivityList({ rid }: { rid: string }) {
  const { data } = useActivityFeed(rid);
  return (
    <ul className="space-y-3">
      {data?.map((a) => (
        <li key={a.id} className="flex gap-3 text-sm">
          <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${a.kind === "order" ? "bg-electric/10 text-electric" : "bg-success/10 text-success"}`}>
            {a.kind === "order" ? <Receipt className="h-3.5 w-3.5" /> : <CalendarDays className="h-3.5 w-3.5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium capitalize">{a.title}</div>
            <div className="truncate text-xs text-muted-foreground">{a.detail}</div>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{ago(a.at)}</span>
        </li>
      ))}
      {data && !data.length && <li className="text-sm text-muted-foreground">No activity yet.</li>}
    </ul>
  );
}
