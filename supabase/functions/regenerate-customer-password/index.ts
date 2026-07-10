import { corsHeaders } from '../_shared/cors.ts';
import { adminClient, callerClient, randomPassword } from '../_shared/clients.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const { customer_id } = await req.json();
    if (!customer_id) throw new Error('customer_id is required');

    const caller = callerClient(authHeader);
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData.user) throw new Error('Not authenticated');

    const { data: customer, error: customerError } = await caller
      .from('customers')
      .select('id, auth_user_id, shop_id')
      .eq('id', customer_id)
      .single();
    if (customerError || !customer) throw new Error('Customer not found');

    const { data: profile } = await caller
      .from('shop_owner_profiles')
      .select('shop_id')
      .eq('user_id', userData.user.id)
      .single();
    if (!profile || profile.shop_id !== customer.shop_id) throw new Error('Not authorized');
    if (!customer.auth_user_id) throw new Error('Customer has no login account');

    const password = randomPassword();
    const admin = adminClient();
    const { error: updateError } = await admin.auth.admin.updateUserById(customer.auth_user_id, { password });
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ password }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    console.error('regenerate-customer-password error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Failed to reset password' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
