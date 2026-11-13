# Seat And Supper Studio

Act as a Senior Full-Stack SaaS Engineer. Build the foundational multi-tenant architecture, database schema, authentication, and separated routing for "TABLEFLOW" (Tagline: "One Platform. Complete Restaurant Operations.").

1. DESIGN SYSTEM & BRANDING:
- Clean, modern SaaS aesthetic using Inter font and JetBrains Mono for order numbers/timers/prices.
- Light mode palette: Canvas #F8FAFC, Cards #FFFFFF, Primary Navy #0F172A, Electric Blue #2563EB, Emerald Success #10B981, Warning Amber #F59E0B, Danger Red #EF4444.
- Dark mode palette (strictly for the Kitchen Display System): Canvas #0B1120, Cards #1E293B.

2. SEPARATED APPLICATION ARCHITECTURE (CRITICAL):
Keep the Restaurant Operations Suite completely separate from the Customer Mobile App:
- Route `/`: SaaS Marketing Landing Page + Login / Restaurant Sign-Up.
- Route `/onboarding`: 6-step Restaurant Setup Wizard (Restaurant Info, Operating Hours, Table Floor Setup, Menu Categories, Payment Setup, Staff Invites).
- Route `/app/*`: Protected Restaurant Operations Suite (Desktop & Tablet) with role-based access:
  - `/app/owner/*`: Full Owner/Admin Dashboard (Overview, Reservations, Floor Plan, Orders, KDS, QR Codes, Menu, Promotions, CRM, Loyalty, Billing, Analytics, Staff, Integrations, Settings, Subscription).
  - `/app/foh`: Dedicated Tablet-optimized Front of House (FOH) interface.
  - `/app/kds`: Dedicated Dark-Mode Kitchen Display System (KDS).
- Route `/guest/:restaurantSlug`: Public, mobile-first Customer Web App (no login required) accessible via Table QR (`?table=T-04`) or Online Booking (`?mode=book`).

3. SUPABASE POSTGRESQL SCHEMA & ROW LEVEL SECURITY (RLS):
Create all core tables with `restaurant_id` foreign keys and strict RLS policies so each restaurant only accesses its own records, while `/guest/:restaurantSlug` can read active menus/tables and insert reservations/orders:
- `restaurants` (id, name, slug, logo_url, address, currency, tax_rate, service_charge_pct, subscription_tier, stripe_account_id, settings_json)
- `staff_members` (id, user_id, restaurant_id, full_name, role [owner, manager, foh, kitchen], pin_code, is_active)
- `tables` (id, restaurant_id, table_number, zone [Main Dining, Patio, Bar], capacity, shape [square, round, rectangle], pos_x, pos_y, status [available, reserved, occupied, waiting_food, bill_requested, cleaning], qr_code_token)
- `menu_categories` (id, restaurant_id, name, sort_order, is_active)
- `menu_items` (id, restaurant_id, category_id, name, description, price, prep_time_mins, station [Main Kitchen, Grill, Starters, Desserts, Bar], image_url, allergens_array, dietary_tags_array, modifiers_json, is_available, is_popular)
- `reservations` (id, restaurant_id, table_id, customer_name, customer_phone, customer_email, party_size, booking_date, arrival_time, eta_time, status [pending, confirmed, arriving_soon, checked_in, seated, completed, cancelled, no_show], special_requests, dietary_notes, deposit_paid)
- `orders` (id, restaurant_id, table_id, reservation_id, order_number, order_type [qr_table, foh_pos, eta_preorder], status [incoming, accepted, preparing, ready, served, cancelled], scheduled_fire_at, subtotal, tax_amount, service_charge, discount_amount, tip_amount, total_amount, payment_status [unpaid, partial, paid], customer_notes)
- `order_items` (id, order_id, menu_item_id, quantity, unit_price, modifiers_selected_json, station, item_status [pending, preparing, ready, served], special_instructions)
- `promotions` (id, restaurant_id, title, code, promo_type [secret_qr, happy_hour, bogo, percentage, fixed, first_time], discount_value, min_order_amount, is_qr_exclusive, is_active, usage_count)
- `customers` (id, restaurant_id, full_name, email, phone, birthday, loyalty_points, loyalty_tier, total_visits, lifetime_spend, tags_array, notes)
- `game_rewards` (id, restaurant_id, customer_phone, game_type, reward_title, discount_code, is_redeemed, expires_at)

Enable Supabase Realtime on `tables`, `reservations`, `orders`, and `order_items`.
Build the authentication flow, database migrations, and seed one realistic demo restaurant ("Bistro Aura", slug: `bistro-aura`) with 12 tables, 15 menu items across 5 categories, and sample reservations so I can test immediately.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://seat-and-supper-studio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4601eab8-3d8e-49b0-a8b7-722d6967d616).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
