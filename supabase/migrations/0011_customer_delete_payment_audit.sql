-- Soft delete for customers: a deleted customer disappears from the owner's customer
-- list, but the row (and all its delivery/payment history) stays intact -- this is a
-- khata app, deliveries and payments are financial records, not disposable rows. Kept
-- separate from is_active ("deactivate/pause", already reversible and still listed) so
-- the two remain distinct concepts: paused vs. removed.
alter table customers add column deleted_at timestamptz;

-- Payment edit audit trail: every edit to a payment (amount/date/note) is recorded here
-- via update_payment() below rather than a bare client-side .update(), so there's always
-- a before/after record of who changed what and when.
create table payment_audit (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments (id) on delete cascade,
  shop_id uuid not null references shops (id) on delete cascade,
  edited_by uuid references auth.users (id),
  edited_at timestamptz not null default now(),
  old_amount numeric(10, 2) not null,
  new_amount numeric(10, 2) not null,
  old_payment_date date not null,
  new_payment_date date not null,
  old_note text,
  new_note text
);
create index on payment_audit (payment_id, edited_at);

alter table payment_audit enable row level security;
grant select, insert on payment_audit to authenticated;
create policy payment_audit_owner_select on payment_audit for select
  using (is_shop_owner(shop_id));
create policy payment_audit_owner_insert on payment_audit for insert
  with check (is_shop_owner(shop_id));

-- Atomic update-and-log so the audit row can never be skipped or diverge from the
-- actual update (as two separate client calls would risk). security invoker (default)
-- so RLS still applies -- is_shop_owner is checked explicitly since the update itself
-- happens before the owning policy would otherwise re-check it, and to give a clean
-- error message instead of a silent "0 rows updated".
create or replace function update_payment(
  p_payment_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_note text
)
returns payments
language plpgsql
as $$
declare
  old_row payments;
  updated_row payments;
begin
  select * into old_row from payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found';
  end if;
  if not is_shop_owner(old_row.shop_id) then
    raise exception 'Not authorized';
  end if;
  if p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  update payments
  set amount = p_amount, payment_date = p_payment_date, note = p_note
  where id = p_payment_id
  returning * into updated_row;

  insert into payment_audit (
    payment_id, shop_id, edited_by,
    old_amount, new_amount, old_payment_date, new_payment_date, old_note, new_note
  ) values (
    p_payment_id, old_row.shop_id, auth.uid(),
    old_row.amount, p_amount, old_row.payment_date, p_payment_date, old_row.note, p_note
  );

  return updated_row;
end;
$$;

grant execute on function update_payment(uuid, numeric, date, text) to authenticated;
