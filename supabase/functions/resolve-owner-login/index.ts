// Maps a shop owner's mobile+password to their synthetic internal auth email(s),
// then signs in on their behalf and hands back session tokens. Mirrors
// resolve-customer-login exactly: a phone number isn't globally unique to one owner
// account -- the same person can own multiple shops, each a separate auth user with
// its own synthetic email, so one mobile+password can match several accounts. We
// verify the password against every matching account (cheap: owner accounts per phone
// are few, and all owner passwords come from the same DEFAULT_PASSWORD secret anyway)
// and return every session that verified. One match -> log straight in. Multiple ->
// let the client show a shop picker; sessions for every choice are already minted, so
// picking one is just a local setSession with no second network round trip.
import { corsHeaders } from '../_shared/cors.ts';
import { adminClient, anonClient } from '../_shared/clients.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { mobile, password } = await req.json();
    if (!mobile || !password) throw new Error('mobile and password are required');

    const admin = adminClient();
    const { data: matches, error } = await admin
      .from('shop_owner_profiles')
      .select('shop_id, internal_auth_email, shops(name)')
      .eq('phone', mobile)
      .not('internal_auth_email', 'is', null);
    if (error) throw error;
    if (!matches || matches.length === 0) throw new Error('Invalid mobile number or password');

    const anon = anonClient();
    const sessions: { shop_id: string; shop_name: string; access_token: string; refresh_token: string }[] = [];
    for (const match of matches) {
      const { data: signInData } = await anon.auth.signInWithPassword({
        email: match.internal_auth_email!,
        password,
      });
      if (signInData?.session) {
        sessions.push({
          shop_id: match.shop_id as string,
          shop_name: (match.shops as { name: string } | null)?.name ?? 'Shop',
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
        });
      }
    }
    if (sessions.length === 0) throw new Error('Invalid mobile number or password');

    if (sessions.length > 1) {
      return new Response(JSON.stringify({ requires_shop_selection: true, shops: sessions }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(
      JSON.stringify({
        access_token: sessions[0].access_token,
        refresh_token: sessions[0].refresh_token,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e) {
    console.error('resolve-owner-login error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Login failed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
