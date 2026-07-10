-- Per-customer running balance for every active customer in a shop, in one query --
-- used by the owner's Reports > Pending Payments / Defaulters list. Reuses the same
-- "delivered value minus payments" definition as customer_running_balance, just
-- computed for all of a shop's customers at once instead of one id at a time.
-- Invoker-security like the other report/read functions: RLS on customers already
-- scopes the outer query to the caller's own shop, so no extra shop check is needed
-- inside the correlated subqueries.
create or replace function shop_customer_balances(p_shop_id uuid)
returns table (customer_id uuid, balance numeric)
language sql
stable
as $$
  select
    c.id as customer_id,
    coalesce((select sum(quantity * unit_price) from delivery_records dr
              where dr.customer_id = c.id and dr.status <> 'skipped'), 0)
    -
    coalesce((select sum(amount) from payments p where p.customer_id = c.id), 0) as balance
  from customers c
  where c.shop_id = p_shop_id and c.is_active;
$$;

grant execute on function shop_customer_balances(uuid) to authenticated;
