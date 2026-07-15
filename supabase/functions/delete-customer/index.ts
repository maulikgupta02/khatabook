// Soft-deletes a customer (row + delivery/payment history stay intact, see 0011) and
// also removes their synthetic auth login. The login has to go with a real auth.users
// delete (not just deactivation) because create-customer's internal email is
// deterministic from shop_id+mobile -- leaving the old auth user in place would keep
// that email permanently taken, blocking the owner from ever re-adding a customer with
// the same mobile number after deleting them.
import { corsHeaders } from '../_shared/cors.ts';
import { adminClient, callerClient } from '../_shared/clients.ts';

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

    const admin = adminClient();

    if (customer.auth_user_id) {
      const { error: deleteAuthError } = await admin.auth.admin.deleteUser(customer.auth_user_id);
      if (deleteAuthError && deleteAuthError.status !== 404) throw deleteAuthError;
    }

    const { error: updateError } = await admin
      .from('customers')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', customer_id);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    console.error('delete-customer error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Could not delete customer' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
