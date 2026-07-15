-- A soft-deleted customer's row stays in place (0011), but the plain unique(shop_id,
-- mobile) constraint from 0001 still counted it -- reusing that mobile number for a
-- new customer failed as "already a customer" even though the owner had deleted them.
-- Swap to a partial unique index that only guards active (non-deleted) rows.
alter table customers drop constraint customers_shop_id_mobile_key;
create unique index customers_shop_id_mobile_active_key on customers (shop_id, mobile) where deleted_at is null;
