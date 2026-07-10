# Khatabook — Daily Delivery Management App

Multi-tenant SaaS for milk/kirana/tiffin/newspaper vendors to track daily deliveries and billing. Full spec and phased build plan: see the plan history (design doc: claude.ai/design project `7f185fc3-a8c2-4082-9a39-cd7270cfd846`, file `Delivery Manager.dc.html`).

## Stack (deliberate departure from the global default Python/FastAPI stack)

- **Frontend**: one Expo Router app (`mobile/`) — React Native + Expo Web serves shop-owner role, customer role, AND the mobile website from a single codebase.
- **Backend**: Supabase-native — Postgres + Supabase Auth + Row Level Security + Edge Functions (Deno/TypeScript, in `supabase/functions/`). No separate FastAPI/Python service.
- **WhatsApp**: official Meta Cloud API (not Twilio, not wa.me links). Real sends require a Meta Business account the user configures outside this codebase.
- **Local dev**: `supabase start` (requires Docker Desktop running) + `cd mobile && npx expo start`.

## Structure

- `mobile/app/` — Expo Router routes: `(auth)` login/signup, `(owner)` shop-owner tabs (today/customers/items/reports), `(customer)` customer tabs (home/bills), `(public)/bill/[token]` public no-auth bill link.
- `mobile/lib/supabase/` — client, session/shop/customer hooks, shared row types, Edge Function error-message helper.
- `mobile/lib/offline/` — offline-first SQLite cache (`db.ts`, `todayCache.ts`) + mutation queue (`queue.ts`, `sync.ts`), used by the owner's Today screen only. Native only (`OFFLINE_SUPPORTED = Platform.OS !== 'web'`) — mweb always has a live connection to whatever served it, so it stays online-only rather than pulling in expo-sqlite's web/IndexedDB backing for a scenario that doesn't apply there.
- `mobile/constants/theme.ts` — design tokens (colors/fonts) converted from the `.dc.html` prototype's oklch palette to hex for React Native compatibility.
- `supabase/migrations/` — schema, RLS, and RPCs, numbered in application order (`0001`–`0006` so far: init, RLS, owner-side pricing RPC, service_role grants, delivery RPC grants, billing/running-balance RPC).
- `supabase/functions/` — Edge Functions: `create-customer`, `resolve-customer-login`, `regenerate-customer-password`, `generate-monthly-bill`, `resolve-bill-token`, plus `_shared/` (CORS, Supabase client factories, WhatsApp sender).

## Key design decisions

- Customer login is mobile+password (not Supabase's native email/phone+OTP). Solved via a synthetic internal email `cust-{shop_id}-{mobile}@internal.khatabook.app` created server-side only; never shown to the customer.
- "Expected delivery for today" is computed on read from `customer_recurring_rules` + `delivery_records` (see `expected_deliveries()` SQL function) — never pre-materialized. This function is `security invoker` (default), so RLS naturally scopes it: an owner calling it sees their whole shop, a customer calling it only ever sees their own row.
- `delivery_records` is the single source of truth for both today's status and monthly billing; `unit_price` is snapshotted at write time so historical bills stay correct after price changes.
- A customer's running balance (`customer_running_balance` RPC) is a lifetime khata balance (all-time delivered value minus all-time payments), not a per-month reset — matches the "permanent daily ledger" requirement. Monthly bills/tokens are a separate concept: a frozen snapshot + shareable link for a specific month.
- Public bill links (`bill_tokens`) have no RLS SELECT policy for anyone — access only via the `resolve-bill-token` Edge Function (service role), which is what actually prevents enumeration. Every failure path (bad token, expired token) returns the same generic message/404.
- **service_role needs explicit table GRANTs even though it bypasses RLS** — BYPASSRLS only skips policy checks, not base Postgres privileges. Hosted Supabase provisions this automatically; a from-scratch local schema needs `0004_service_role_grants.sql` or Edge Functions using the admin client get `permission denied`.
- **Local Supabase issues two key formats**: legacy JWT `ANON_KEY`/`SERVICE_ROLE_KEY` and newer non-JWT `sb_publishable_...`/`sb_secret_...` keys. `mobile/.env` uses the publishable key (what `supabase-js` expects). Edge Functions that must be callable *before* a user has a session (`resolve-customer-login`, `resolve-bill-token`) need `verify_jwt = false` in `supabase/config.toml`, because the publishable key isn't a JWT the functions relay can verify — only a real signed-in user's session JWT passes that check.
- WhatsApp sends go through `_shared/whatsapp.ts` (`sendWhatsApp`), called from `create-customer` (welcome), `regenerate-customer-password` (password reset), and `generate-monthly-bill` (bill ready). Every call writes to `whatsapp_log` regardless of outcome. Without `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` set (see `supabase/functions/.env.example`), it logs the exact Meta Cloud API payload as `status: 'queued'` instead of calling the network — verified end-to-end including a real-but-invalid-credentials call that Meta's API correctly rejected with a parseable error, proving the request shape is right.
- Offline writes (`upsert_delivery`, `bulk_complete_remaining` RPCs, `supabase/migrations/0007_offline_rpcs.sql`) exist because PostgREST's `.upsert()` can't target a *partial* unique index (`delivery_records_regular_unique ... where is_extra = false`) — only a plpgsql function with a raw `ON CONFLICT (...) WHERE ... DO UPDATE` can. The mutation queue (`mobile/lib/offline/queue.ts`) replays strictly in `created_at` order and **stops at the first failure** rather than skipping past it — continuing out of order risks a later mutation applying before an earlier stuck one, which would silently revert the user's most recent edit once the earlier one finally succeeds (both target the same conflict key). `bulk_complete_remaining` recomputes "what's still pending" server-side at sync time from live data, so it's safe even if another device completed some of the same rows in the meantime.

Current phase status is tracked in the session's task list, not here.
