import { createFileRoute } from "@tanstack/react-router";
import { Logo } from "@/components/tf/Logo";
import { AuthCard } from "@/components/tf/AuthCard";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TABLEFLOW" },
      { name: "description", content: "Sign in to your TABLEFLOW restaurant workspace or register a new restaurant." },
      { property: "og:title", content: "Sign in — TABLEFLOW" },
      { property: "og:description", content: "Access your restaurant operations suite." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="grid min-h-screen place-items-center bg-hero px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center"><Logo /></div>
        <AuthCard />
      </div>
    </div>
  ),
});
