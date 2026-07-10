// Maps a customer's mobile+password to their synthetic internal auth email,
// then signs in on their behalf and hands back session tokens. No RLS policy
// ever exposes internal_auth_email to the client -- only this service-role path does.
import { corsHeaders } from '../_shared/cors.ts';
import { adminClient, anonClient } from '../_shared/clients.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { mobile, password } = await req.json();
    if (!mobile || !password) throw new Error('mobile and password are required');

    const admin = adminClient();
    const { data: matches, error } = await admin
      .from('customers')
      .select('id, internal_auth_email')
      .eq('mobile', mobile)
      .eq('is_active', true)
      .not('internal_auth_email', 'is', null);
    if (error) throw error;
    if (!matches || matches.length === 0) throw new Error('Invalid mobile number or password');
    if (matches.length > 1) throw new Error('Multiple accounts found for this number -- contact your shop');

    const anon = anonClient();
    const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
      email: matches[0].internal_auth_email!,
      password,
    });
    if (signInError || !signInData.session) throw new Error('Invalid mobile number or password');

    return new Response(
      JSON.stringify({
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e) {
    console.error('resolve-customer-login error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Login failed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
