-- Owners log in with mobile+password now (mirroring customers), instead of a real
-- email + password. Same synthetic-email scheme: owner-{shop_id}-{phone}@internal...,
-- generated server-side, never shown to the owner. This keeps shop_owner_profiles.user_id
-- as a 1:1 PK per shop (unchanged) -- a person who owns multiple shops just gets a
-- separate auth user + profile row per shop, same phone, exactly like multi-shop customers.
alter table shop_owner_profiles add column internal_auth_email text;
