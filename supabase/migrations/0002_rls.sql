-- Row Level Security: shop-owner isolation + customer self-service isolation.
-- Public bill links are deliberately NOT exposed via any RLS policy here -- the
-- resolve-bill-token Edge Function uses the service role and returns a narrow,
-- hand-shaped JSON response instead, which is what actually prevents enumeration.

create or replace function is_shop_owner(p_shop_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from shop_owner_profiles
    where user_id = auth.uid() and shop_id = p_shop_id
  );
$$;

create or replace function is_shop_owner_for_customer(p_customer_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from customers c
    join shop_owner_profiles sop on sop.shop_id = c.shop_id
    where c.id = p_customer_id and sop.user_id = auth.uid()
  );
$$;

create or replace function current_customer_id()
returns uuid language sql stable as $$
  select id from customers where auth_user_id = auth.uid();
$$;

grant usage on schema public to authenticated;

-- shops
alter table shops enable row level security;
grant select, insert, update on shops to authenticated;
create policy shops_select_own on shops for select using (owner_user_id = auth.uid());
create policy shops_insert_self on shops for insert with check (owner_user_id = auth.uid());
create policy shops_update_own on shops for update using (owner_user_id = auth.uid());

-- shop_owner_profiles
alter table shop_owner_profiles enable row level security;
grant select, insert, update on shop_owner_profiles to authenticated;
create policy sop_select_own on shop_owner_profiles for select using (user_id = auth.uid());
create policy sop_insert_own on shop_owner_profiles for insert with check (user_id = auth.uid());
create policy sop_update_own on shop_owner_profiles for update using (user_id = auth.uid());

-- items: owner manages; customers can read their own shop's catalog
alter table items enable row level security;
grant select, insert, update on items to authenticated;
create policy items_owner_all on items for all
  using (is_shop_owner(shop_id)) with check (is_shop_owner(shop_id));
create policy items_customer_select on items for select
  using (shop_id = (select shop_id from customers where id = current_customer_id()));

-- item_price_history: owner manages; customers can read (bill display)
alter table item_price_history enable row level security;
grant select, insert, update on item_price_history to authenticated;
create policy iph_owner_all on item_price_history for all
  using (is_shop_owner((select shop_id from items where id = item_id)))
  with check (is_shop_owner((select shop_id from items where id = item_id)));
create policy iph_customer_select on item_price_history for select
  using ((select shop_id from items where id = item_id) =
         (select shop_id from customers where id = current_customer_id()));

-- customers: owner manages; customer can read own row only
alter table customers enable row level security;
grant select, insert, update on customers to authenticated;
create policy customers_owner_all on customers for all
  using (is_shop_owner(shop_id)) with check (is_shop_owner(shop_id));
create policy customers_self_select on customers for select
  using (auth_user_id = auth.uid());

-- customer_recurring_rules: owner manages; customer reads own
alter table customer_recurring_rules enable row level security;
grant select, insert, update on customer_recurring_rules to authenticated;
create policy crr_owner_all on customer_recurring_rules for all
  using (is_shop_owner_for_customer(customer_id))
  with check (is_shop_owner_for_customer(customer_id));
create policy crr_customer_select on customer_recurring_rules for select
  using (customer_id = current_customer_id());

-- delivery_records: owner manages; customer reads own
alter table delivery_records enable row level security;
grant select, insert, update on delivery_records to authenticated;
create policy dr_owner_all on delivery_records for all
  using (is_shop_owner(shop_id)) with check (is_shop_owner(shop_id));
create policy dr_customer_select on delivery_records for select
  using (customer_id = current_customer_id());

-- payments: owner manages; customer reads own
alter table payments enable row level security;
grant select, insert, update on payments to authenticated;
create policy payments_owner_all on payments for all
  using (is_shop_owner(shop_id)) with check (is_shop_owner(shop_id));
create policy payments_customer_select on payments for select
  using (customer_id = current_customer_id());

-- monthly_bills: owner manages; customer reads own
alter table monthly_bills enable row level security;
grant select, insert, update on monthly_bills to authenticated;
create policy mb_owner_all on monthly_bills for all
  using (is_shop_owner(shop_id)) with check (is_shop_owner(shop_id));
create policy mb_customer_select on monthly_bills for select
  using (customer_id = current_customer_id());

-- bill_tokens: owner can see tokens for their own customers; no self-serve insert
-- (created only by the generate-monthly-bill Edge Function via the service role).
alter table bill_tokens enable row level security;
grant select on bill_tokens to authenticated;
create policy bt_owner_select on bill_tokens for select
  using (is_shop_owner_for_customer(customer_id));

-- delivery_flags: customer can raise a flag on their own delivery; owner manages resolution
alter table delivery_flags enable row level security;
grant select, insert, update on delivery_flags to authenticated;
create policy flags_owner_all on delivery_flags for all
  using (is_shop_owner_for_customer(customer_id))
  with check (is_shop_owner_for_customer(customer_id));
create policy flags_customer_select on delivery_flags for select
  using (customer_id = current_customer_id());
create policy flags_customer_insert on delivery_flags for insert
  with check (customer_id = current_customer_id() and raised_by = auth.uid());

-- whatsapp_log: owner-readable only; all writes happen via the service role in Edge Functions
alter table whatsapp_log enable row level security;
grant select on whatsapp_log to authenticated;
create policy wal_owner_select on whatsapp_log for select
  using (is_shop_owner(shop_id));
