// Freezes a total for a month and mints (or reuses) the public bill-link token.
// bill_tokens has no owner insert policy on purpose (see 0002_rls.sql) -- only this
// service-role path can create one, so the token space stays fully server-controlled.
import { corsHeaders } from '../_shared/cors.ts';
import { adminClient, callerClient, randomToken } from '../_shared/clients.ts';
import { sendWhatsApp } from '../_shared/whatsapp.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const { customer_id, month } = await req.json();
    if (!customer_id || !month) throw new Error('customer_id and month (YYYY-MM) are required');
    const monthStart = `${month}-01`;

    const caller = callerClient(authHeader);
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData.user) throw new Error('Not authenticated');

    const { data: customer, error: customerError } = await caller
      .from('customers')
      .select('id, shop_id, mobile')
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
    const start = new Date(`${monthStart}T00:00:00Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const monthEnd = end.toISOString().slice(0, 10);

    const { data: deliveries, error: deliveriesError } = await admin
      .from('delivery_records')
      .select('quantity, unit_price')
      .eq('customer_id', customer_id)
      .gte('delivery_date', monthStart)
      .lt('delivery_date', monthEnd)
      .neq('status', 'skipped');
    if (deliveriesError) throw deliveriesError;

    const totalAmount = (deliveries ?? []).reduce((sum, d) => sum + Number(d.quantity) * Number(d.unit_price), 0);

    const { data: existingToken } = await admin
      .from('bill_tokens')
      .select('id, token')
      .eq('customer_id', customer_id)
      .eq('month', monthStart)
      .maybeSingle();

    let tokenId = existingToken?.id;
    let token = existingToken?.token;
    if (!existingToken) {
      token = randomToken();
      const { data: newToken, error: tokenError } = await admin
        .from('bill_tokens')
        .insert({ token, customer_id, month: monthStart })
        .select()
        .single();
      if (tokenError) throw tokenError;
      tokenId = newToken.id;
    }

    const { error: billError } = await admin
      .from('monthly_bills')
      .upsert(
        {
          shop_id: customer.shop_id,
          customer_id,
          month: monthStart,
          total_amount: totalAmount,
          bill_token_id: tokenId,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'customer_id,month' }
      );
    if (billError) throw billError;

    const { data: shop } = await admin.from('shops').select('name').eq('id', customer.shop_id).single();
    const webBaseUrl = Deno.env.get('PUBLIC_WEB_BASE_URL') ?? 'http://localhost:8081';
    await sendWhatsApp(admin, {
      shopId: customer.shop_id,
      customerId: customer.id,
      to: customer.mobile,
      templateName: 'bill_ready',
      bodyParams: [shop?.name ?? 'your shop', month, totalAmount.toFixed(2), `${webBaseUrl}/bill/${token}`],
    });

    return new Response(JSON.stringify({ token, total_amount: totalAmount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    console.error('generate-monthly-bill error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Could not generate bill' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
