-- Running lifetime balance for a customer: total delivered value (excluding skipped
-- days, which are never charged) minus total recorded payments. This is deliberately
-- NOT scoped to a single month -- it's a running khata balance, not a monthly reset.
-- Runs as invoker (default), so RLS on delivery_records/payments still applies: a
-- customer calling this for their own id sums their own rows; anyone else's id just
-- resolves to zero visible rows rather than leaking data.
create or replace function customer_running_balance(p_customer_id uuid)
returns numeric
language sql
stable
as $$
  select
    coalesce((select sum(quantity * unit_price) from delivery_records
              where customer_id = p_customer_id and status <> 'skipped'), 0)
    -
    coalesce((select sum(amount) from payments where customer_id = p_customer_id), 0);
$$;

grant execute on function customer_running_balance(uuid) to authenticated;
