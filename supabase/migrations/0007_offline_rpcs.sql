-- Single idempotent entry point for writing a delivery record, used by both the
-- online Today screen and the offline mutation-queue replay engine. Postgres lets
-- ON CONFLICT target a partial unique index directly (matching its WHERE clause),
-- which PostgREST's client-side upsert cannot express -- hence a dedicated RPC
-- rather than a plain .upsert() call.
--
-- Regular deliveries (is_extra = false) conflict-resolve on the one-row-per-day
-- partial unique index, so replaying the same logical action twice (e.g. after a
-- dropped connection) safely updates the same row instead of erroring or duplicating.
-- Extras conflict-resolve on client_mutation_id alone (their own unique index),
-- since multiple extras per customer/item/day are allowed by design -- only an
-- exact-same-mutation replay should be a no-op.
create or replace function upsert_delivery(
  p_client_mutation_id uuid,
  p_shop_id uuid,
  p_customer_id uuid,
  p_item_id uuid,
  p_delivery_date date,
  p_quantity numeric,
  p_unit_price numeric,
  p_status delivery_status,
  p_is_extra boolean
)
returns delivery_records
language plpgsql
as $$
declare
  v_row delivery_records;
begin
  if p_is_extra then
    insert into delivery_records
      (client_mutation_id, shop_id, customer_id, item_id, delivery_date, quantity, unit_price, status, is_extra)
    values
      (p_client_mutation_id, p_shop_id, p_customer_id, p_item_id, p_delivery_date, p_quantity, p_unit_price, p_status, true)
    on conflict (client_mutation_id) do nothing
    returning * into v_row;

    if v_row.id is null then
      select * into v_row from delivery_records where client_mutation_id = p_client_mutation_id;
    end if;
  else
    insert into delivery_records
      (client_mutation_id, shop_id, customer_id, item_id, delivery_date, quantity, unit_price, status, is_extra)
    values
      (p_client_mutation_id, p_shop_id, p_customer_id, p_item_id, p_delivery_date, p_quantity, p_unit_price, p_status, false)
    on conflict (customer_id, item_id, delivery_date) where (is_extra = false)
    do update set
      quantity = excluded.quantity,
      unit_price = excluded.unit_price,
      status = excluded.status,
      client_mutation_id = excluded.client_mutation_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

grant execute on function upsert_delivery(uuid, uuid, uuid, uuid, date, numeric, numeric, delivery_status, boolean) to authenticated;

-- Expands "all pending expected deliveries for this shop+date" server-side, at
-- sync time, using live data -- not a client-captured list. This is what makes
-- "Complete Remaining" safe to queue as a single offline mutation: two devices
-- completing the same round won't double-insert, and a delivery someone else
-- already recorded in the meantime won't be silently overwritten (expected_deliveries
-- only reports rows that are still actually pending).
create or replace function bulk_complete_remaining(p_shop_id uuid, p_date date)
returns setof delivery_records
language plpgsql
as $$
begin
  return query
  insert into delivery_records (shop_id, customer_id, item_id, delivery_date, quantity, unit_price, status, is_extra)
  select p_shop_id, e.customer_id, e.item_id, p_date, e.expected_quantity, e.unit_price, 'delivered', false
  from expected_deliveries(p_shop_id, p_date) e
  where e.record_id is null
  returning *;
end;
$$;

grant execute on function bulk_complete_remaining(uuid, date) to authenticated;
