<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Architecture
- Multi-tenant: every business table carries `restaurant_id`; RLS uses security-definer `is_member` / `has_staff_role` so each restaurant sees only its rows.
- Guests (no login) never write orders directly: they call the `place_guest_order` RPC, which prices items server-side.
- Restaurant creation goes through the `create_restaurant` RPC so the creator always becomes owner atomically.
- `/app/*` is a client-only gate (`ssr: false`); role-to-area rules live in `src/lib/tenant.ts` (`AREA_ROLES`) and are tested in `src/test/roles.test.ts`.
- Kitchen Display is the only dark-mode surface: it wraps its tree in `.dark`.
- Pre-order firing mode lives in `restaurants.settings_json.preorder_fire_mode`; approval sets `orders.scheduled_fire_at` via `computeFireAt` (`'infinity'` = held for manual FOH fire) and the KDS hides orders until that time.
- The owner top-bar date filter is shared through `DateRangeContext` (`src/lib/date-range.ts`); owner pages read it instead of keeping their own range.
