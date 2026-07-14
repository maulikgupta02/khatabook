import { createClient } from 'npm:@supabase/supabase-js@2';

export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function anonClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function callerClient(authHeader: string) {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Shared initial/reset password for every customer and shop-owner login, so it can be
// stated as plain text in WhatsApp templates instead of a per-user secret variable --
// Meta's classifier routes any credential-shaped template variable to the AUTHENTICATION
// category, which only supports a single OTP-style code and can't carry shop/owner context.
// Set via `supabase secrets set DEFAULT_PASSWORD=...` -- never hardcode the real value here,
// this is a live credential for every account and this file is committed to a public repo.
export function defaultPassword() {
  const value = Deno.env.get('DEFAULT_PASSWORD');
  if (!value) throw new Error('DEFAULT_PASSWORD secret is not set');
  return value;
}

// Long, unguessable, URL-safe token for public bill links -- this is the only thing
// standing between "anyone with the link" and "anyone who can enumerate", so it needs
// to be long and drawn from a real CSPRNG, not the shorter human-typed password alphabet.
export function randomToken(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
