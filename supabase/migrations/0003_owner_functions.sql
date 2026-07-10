-- Atomic price-change helper: closes the current price row (or corrects it if
-- the new effective_from is the same day) and opens the new one in one statement,
-- so the "exactly one current row" partial unique index is never violated mid-write.
create or replace function set_item_price(p_item_id uuid, p_price numeric, p_effective_from date default current_date)
returns void
language plpgsql
as $$
declare
  v_existing_id uuid;
begin
  select id into v_existing_id
  from item_price_history
  where item_id = p_item_id and effective_to is null and effective_from = p_effective_from;

  if v_existing_id is not null then
    update item_price_history set price = p_price where id = v_existing_id;
    return;
  end if;

  update item_price_history
    set effective_to = p_effective_from - 1
    where item_id = p_item_id and effective_to is null and effective_from < p_effective_from;

  insert into item_price_history (item_id, price, effective_from, effective_to)
  values (p_item_id, p_price, p_effective_from, null);
end;
$$;

grant execute on function set_item_price(uuid, numeric, date) to authenticated;
