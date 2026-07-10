# Khatabook — Daily Delivery Management App

Multi-tenant SaaS for milk/kirana/tiffin/newspaper vendors to track daily deliveries and billing. Full spec and phased build plan: see the plan history (design doc: claude.ai/design project `7f185fc3-a8c2-4082-9a39-cd7270cfd846`, file `Delivery Manager.dc.html`).

## Stack (deliberate departure from the global default Python/FastAPI stack)

- **Frontend**: one Expo Router app (`mobile/`) — React Native + Expo Web serves shop-owner role, customer role, AND the mobile website from a single codebase.
- **Backend**: Supabase-native — Postgres + Supabase Auth + Row Level Security + Edge Functions (Deno/TypeScript, in `supabase/functions/`). No separate FastAPI/Python service.
- **WhatsApp**: official Meta Cloud API (not Twilio, not wa.me links). Real sends require a Meta Business account the user configures outside this codebase.
- **Local dev**: `supabase start` (requires Docker Desktop running) + `cd mobile && npx expo start`.

## Structure

- `mobile/app/` — Expo Router routes: `(auth)` login, `(owner)` shop-owner tabs, `(customer)` customer tabs, `(public)/bill/[token]` public no-auth bill link.
- `mobile/lib/supabase/` — Supabase client + session hook.
- `mobile/lib/offline/` — offline-first SQLite cache + mutation queue (Phase 5).
- `mobile/constants/theme.ts` — design tokens (colors/fonts) converted from the `.dc.html` prototype's oklch palette to hex for React Native compatibility.
- `supabase/migrations/` — schema (`0001_init.sql`) + RLS policies (`0002_rls.sql`).
- `supabase/functions/` — Edge Functions (added from Phase 1 onward).

## Key design decisions

- Customer login is mobile+password (not Supabase's native email/phone+OTP). Solved via a synthetic internal email `cust-{shop_id}-{mobile}@internal.khatabook.app` created server-side only; never shown to the customer.
- "Expected delivery for today" is computed on read from `customer_recurring_rules` + `delivery_records` (see `expected_deliveries()` SQL function) — never pre-materialized.
- `delivery_records` is the single source of truth for both today's status and monthly billing; `unit_price` is snapshotted at write time so historical bills stay correct after price changes.
- Public bill links (`bill_tokens`) have no RLS SELECT policy for anyone — access only via the `resolve-bill-token` Edge Function (service role), which is what actually prevents enumeration.

Current phase status is tracked in the session's task list, not here.
