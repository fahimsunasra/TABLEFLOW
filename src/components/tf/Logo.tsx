import { Link } from "@tanstack/react-router";

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-electric text-electric-foreground shadow-glow">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M4 7h16M7 7v10M17 7v10M4 17h16" strokeLinecap="round" />
        </svg>
      </span>
      <span className={`text-lg font-bold tracking-tight ${inverted ? "text-sidebar-accent-foreground" : "text-foreground"}`}>
        TABLE<span className="text-electric">FLOW</span>
      </span>
    </Link>
  );
}
