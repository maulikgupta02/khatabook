-- Owners can now delete a delivery_records row (Today screen bin icon, e.g. to undo an
-- accidental mark/extra rather than editing it). dr_owner_all already covers delete via
-- RLS ("for all"), but 0002_rls.sql's grant only listed select/insert/update -- BYPASSRLS
-- policies still need the underlying table privilege (see 0004's service_role note, same
-- principle applies to authenticated here).
grant delete on delivery_records to authenticated;
