// Onboards a new shop + its owner login. There is no self-serve signup in this
// app (removed deliberately) -- this is an internal admin tool, not something a
// shop owner ever calls themselves. It's authorized by the Supabase service role
// key directly (see the check below) rather than a normal user session, since no
// user is signed in yet when a shop is first being created. Only whoever holds
// the service role secret (i.e. us, via a script) can call this.
import { corsHeaders } from '../_shared/cors.ts';
import { adminClient, randomPassword } from '../_shared/clients.ts';
import { sendWhatsApp } from '../_shared/whatsapp.ts';

const SHOP_CATEGORIES = ['milk', 'kirana', 'tiffin', 'newspaper', 'other'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
      throw new Error('Not authorized');
    }

    const { shop_name, category, owner_name, owner_email, owner_phone } = await req.json();
    if (!shop_name || !owner_name || !owner_email) {
      throw new Error('shop_name, owner_name, and owner_email are required');
    }
    const shopCategory = category && SHOP_CATEGORIES.includes(category) ? category : 'other';

    const admin = adminClient();
    const password = randomPassword();

    const { data: authUser, error: createAuthError } = await admin.auth.admin.createUser({
      email: owner_email,
      password,
      email_confirm: true,
    });
    if (createAuthError || !authUser.user) {
      throw new Error(
        createAuthError?.message?.includes('already been registered')
          ? 'An account with this email already exists'
          : createAuthError?.message ?? 'Failed to create owner login'
      );
    }

    const { data: shop, error: shopError } = await admin
      .from('shops')
      .insert({ name: shop_name, category: shopCategory, owner_user_id: authUser.user.id })
      .select()
      .single();
    if (shopError) {
      await admin.auth.admin.deleteUser(authUser.user.id);
      throw new Error(shopError.message);
    }

    const { error: profileError } = await admin
      .from('shop_owner_profiles')
      .insert({ user_id: authUser.user.id, shop_id: shop.id, full_name: owner_name, phone: owner_phone ?? null });
    if (profileError) {
      await admin.auth.admin.deleteUser(authUser.user.id); // cascades shops row too
      throw new Error(profileError.message);
    }

    if (owner_phone) {
      await sendWhatsApp(admin, {
        shopId: shop.id,
        customerId: null,
        to: owner_phone,
        templateName: 'shop_owner_welcome',
        bodyParams: [owner_name, shop_name, owner_email, password],
      });
    }

    return new Response(JSON.stringify({ shop, password }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    console.error('create-shop error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
