-- price_on_date/expected_deliveries were defined in 0001 without an explicit grant.
-- Row access is still governed by RLS on the underlying tables either way, but be
-- explicit about function execute rights rather than relying on default PUBLIC grants.
grant execute on function price_on_date(uuid, date) to authenticated;
grant execute on function expected_deliveries(uuid, date) to authenticated;
