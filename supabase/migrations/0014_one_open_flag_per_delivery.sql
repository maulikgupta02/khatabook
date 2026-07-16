-- Customers can only have one open dispute per delivery at a time (client already hides
-- the Flag button while one is open, but that's UI-only -- nothing stopped a duplicate
-- insert via a race, two devices, or a direct API call). Once the owner resolves/dismisses
-- it, a new flag can be raised again for the same delivery.
create unique index delivery_flags_one_open_per_record on delivery_flags (delivery_record_id) where (status = 'open');
