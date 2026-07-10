-- Core schema for the multi-tenant delivery management app.
create extension if not exists pgcrypto;

create type shop_category as enum ('milk', 'kirana', 'tiffin', 'newspaper', 'other');
create type delivery_status as enum ('delivered', 'changed', 'skipped', 'extra');
create type flag_status as enum ('open', 'resolved', 'dismissed');
create type whatsapp_status as enum ('queued', 'sent', 'failed');

create table shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category shop_category not null default 'other',
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table shop_owner_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  shop_id uuid not null references shops (id) on delete cascade,
  full_name text not null,
  phone text
);
create index on shop_owner_profiles (shop_id);

create table items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  name text not null,
  unit text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on items (shop_id);

-- Effective-dated pricing: exactly one row per item has effective_to = null (the current price).
create table item_price_history (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items (id) on delete cascade,
  price numeric(10, 2) not null,
  effective_from date not null,
  effective_to date,
  constraint item_price_history_range_valid check (effective_to is null or effective_to >= effective_from)
);
create index on item_price_history (item_id, effective_from);
create unique index item_price_history_one_current on item_price_history (item_id) where (effective_to is null);

create table customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  name text not null,
  mobile text not null,
  address text not null,
  delivery_notes text,
  auth_user_id uuid references auth.users (id) on delete set null,
  internal_auth_email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (shop_id, mobile)
);
create index on customers (shop_id);
create index on customers (auth_user_id);

create table customer_recurring_rules (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  item_id uuid not null references items (id) on delete cascade,
  days_of_week smallint[] not null, -- 0 (Sun) .. 6 (Sat)
  quantity numeric(10, 2) not null check (quantity > 0),
  is_active boolean not null default true,
  start_date date not null default current_date,
  unique (customer_id, item_id)
);
create index on customer_recurring_rules (customer_id);

-- Daily ledger: the single source of truth for both "today's status" and billing.
create table delivery_records (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  item_id uuid not null references items (id) on delete cascade,
  delivery_date date not null,
  quantity numeric(10, 2) not null check (quantity >= 0),
  unit_price numeric(10, 2) not null, -- snapshot at time of delivery, never re-derived
  status delivery_status not null,
  is_extra boolean not null default false,
  client_mutation_id uuid not null default gen_random_uuid(), -- offline-sync idempotency key
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  synced_at timestamptz
);
create index on delivery_records (shop_id, delivery_date);
create index on delivery_records (customer_id, delivery_date);
create unique index delivery_records_client_mutation_id_key on delivery_records (client_mutation_id);
-- One regular (non-extra) record per customer/item/day; extras may repeat and are keyed by client_mutation_id instead.
create unique index delivery_records_regular_unique on delivery_records (customer_id, item_id, delivery_date) where (is_extra = false);

create table payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  note text,
  recorded_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index on payments (customer_id, payment_date);

create table bill_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  customer_id uuid not null references customers (id) on delete cascade,
  month date not null, -- first-of-month
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create index on bill_tokens (customer_id, month);

create table monthly_bills (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  month date not null,
  total_amount numeric(10, 2) not null,
  generated_at timestamptz not null default now(),
  bill_token_id uuid references bill_tokens (id),
  unique (customer_id, month)
);
create index on monthly_bills (shop_id, month);

create table delivery_flags (
  id uuid primary key default gen_random_uuid(),
  delivery_record_id uuid not null references delivery_records (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  raised_by uuid not null references auth.users (id),
  reason_text text not null,
  status flag_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_note text
);
create index on delivery_flags (customer_id);

create table whatsapp_log (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops (id) on delete cascade,
  customer_id uuid references customers (id) on delete set null,
  template_name text not null,
  payload jsonb not null,
  status whatsapp_status not null default 'queued',
  provider_message_id text,
  error text,
  created_at timestamptz not null default now()
);
create index on whatsapp_log (shop_id, created_at);

-- Price active on a given date for an item.
create or replace function price_on_date(p_item_id uuid, p_date date)
returns numeric
language sql
stable
as $$
  select price from item_price_history
  where item_id = p_item_id
    and effective_from <= p_date
    and (effective_to is null or effective_to >= p_date)
  limit 1;
$$;

-- "Expected delivery for today" computed from recurring rules + actual ledger rows, not materialized.
create or replace function expected_deliveries(p_shop_id uuid, p_date date)
returns table (
  customer_id uuid,
  item_id uuid,
  expected_quantity numeric,
  record_id uuid,
  actual_quantity numeric,
  unit_price numeric,
  status delivery_status
)
language sql
stable
as $$
  select
    c.id as customer_id,
    r.item_id,
    r.quantity as expected_quantity,
    dr.id as record_id,
    dr.quantity as actual_quantity,
    coalesce(dr.unit_price, price_on_date(r.item_id, p_date)) as unit_price,
    dr.status
  from customers c
  join customer_recurring_rules r on r.customer_id = c.id and r.is_active
  left join delivery_records dr
    on dr.customer_id = c.id
   and dr.item_id = r.item_id
   and dr.delivery_date = p_date
   and dr.is_extra = false
  where c.shop_id = p_shop_id
    and c.is_active
    and r.start_date <= p_date
    and extract(dow from p_date)::smallint = any (r.days_of_week);
$$;
