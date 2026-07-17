// Onboards a new shop + its owner login. There is no self-serve signup in this
// app (removed deliberately) -- this is an internal admin tool, not something a
// shop owner ever calls themselves. It's authorized by the Supabase service role
// key directly (see the check below) rather than a normal user session, since no
// user is signed in yet when a shop is first being created. Only whoever holds
// the service role secret (i.e. us, via a script) can call this.
import { corsHeaders } from '../_shared/cors.ts';
import { adminClient, defaultPassword } from '../_shared/clients.ts';
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

    const { shop_name, category, owner_name, owner_phone } = await req.json();
    if (!shop_name || !owner_name || !owner_phone) {
      throw new Error('shop_name, owner_name, and owner_phone are required');
    }
    if (!/^\d{10}$/.test(owner_phone)) {
      throw new Error('owner_phone must be a 10-digit local number (no country code)');
    }
    const shopCategory = category && SHOP_CATEGORIES.includes(category) ? category : 'other';

    const admin = adminClient();
    const password = defaultPassword();
    const storedPhone = `91${owner_phone}`;
    // Owner login is mobile+password, same as customers -- a synthetic email is the
    // actual Supabase Auth identity underneath. It doesn't need to embed shop_id (unlike
    // customers' cust-{shop_id}-{mobile} scheme) because the shop doesn't exist yet at this
    // point; a random suffix is enough to keep it unique across shops sharing one phone.
    const internalEmail = `owner-${crypto.randomUUID()}-${storedPhone}@internal.khatabook.app`;

    const { data: authUser, error: createAuthError } = await admin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
    });
    if (createAuthError || !authUser.user) {
      throw new Error(createAuthError?.message ?? 'Failed to create owner login');
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

    const { error: profileError } = await admin.from('shop_owner_profiles').insert({
      user_id: authUser.user.id,
      shop_id: shop.id,
      full_name: owner_name,
      phone: storedPhone,
      internal_auth_email: internalEmail,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(authUser.user.id); // cascades shops row too
      throw new Error(profileError.message);
    }

    const webBaseUrl = Deno.env.get('PUBLIC_WEB_BASE_URL') ?? 'http://localhost:8081';
    await sendWhatsApp(admin, {
      shopId: shop.id,
      customerId: null,
      to: storedPhone,
      templateName: 'shop_owner_welcome_v5',
      bodyParams: [owner_name, shop_name, webBaseUrl],
    });

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
