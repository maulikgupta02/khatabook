-- service_role bypasses RLS policies, but Postgres still requires base table GRANTs
-- separately from that -- BYPASSRLS only skips policy checks, it doesn't imply access.
-- Edge Functions use the service role key precisely to reach across shops/customers
-- (create-customer, resolve-customer-login, regenerate-customer-password), so it needs
-- full table access, matching how hosted Supabase provisions this role by default.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
