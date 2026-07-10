// Creates a customer row + a synthetic-email auth user so the customer can log in
// with mobile+password. Returns the generated password once -- it is never stored
// in plaintext and never shown again after this response.
import { corsHeaders } from '../_shared/cors.ts';
import { adminClient, callerClient, randomPassword } from '../_shared/clients.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const { name, mobile, address, delivery_notes } = await req.json();
    if (!name || !mobile || !address) throw new Error('name, mobile, and address are required');

    const caller = callerClient(authHeader);
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData.user) throw new Error('Not authenticated');

    const { data: profile, error: profileError } = await caller
      .from('shop_owner_profiles')
      .select('shop_id')
      .eq('user_id', userData.user.id)
      .single();
    if (profileError || !profile) throw new Error('Not a shop owner');

    const shopId = profile.shop_id as string;
    const admin = adminClient();
    const internalEmail = `cust-${shopId}-${mobile}@internal.khatabook.app`;
    const password = randomPassword();

    const { data: authUser, error: createAuthError } = await admin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
    });
    if (createAuthError || !authUser.user) {
      throw new Error(createAuthError?.message ?? 'Failed to create customer login');
    }

    const { data: customer, error: insertError } = await admin
      .from('customers')
      .insert({
        shop_id: shopId,
        name,
        mobile,
        address,
        delivery_notes: delivery_notes ?? null,
        auth_user_id: authUser.user.id,
        internal_auth_email: internalEmail,
      })
      .select()
      .single();

    if (insertError) {
      await admin.auth.admin.deleteUser(authUser.user.id);
      throw new Error(insertError.message.includes('duplicate') ? 'This mobile number is already a customer' : insertError.message);
    }

    return new Response(JSON.stringify({ customer, password }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    console.error('create-customer error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
