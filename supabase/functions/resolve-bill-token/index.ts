// No RLS policy grants anonymous access to bill_tokens/customers/delivery_records --
// this service-role function, and the token itself, are the only way in. Every failure
// path returns the same generic message so a bad token can't be distinguished from an
// expired one, which is what actually prevents enumeration.
import { corsHeaders } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';

const GENERIC_ERROR = 'This bill link is invalid or has expired.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { token } = await req.json();
    if (!token) throw new Error(GENERIC_ERROR);

    const admin = adminClient();
    const { data: bt, error: btError } = await admin
      .from('bill_tokens')
      .select('id, customer_id, month, expires_at')
      .eq('token', token)
      .maybeSingle();
    if (btError || !bt) throw new Error(GENERIC_ERROR);
    if (bt.expires_at && new Date(bt.expires_at).getTime() < Date.now()) throw new Error(GENERIC_ERROR);

    const { data: customer, error: customerError } = await admin
      .from('customers')
      .select('name, address, shop_id')
      .eq('id', bt.customer_id)
      .single();
    if (customerError || !customer) throw new Error(GENERIC_ERROR);

    const { data: shop } = await admin.from('shops').select('name').eq('id', customer.shop_id).single();

    const monthStart = bt.month as string;
    const start = new Date(`${monthStart}T00:00:00Z`);
    const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);

    const { data: deliveries } = await admin
      .from('delivery_records')
      .select('delivery_date, item_id, quantity, unit_price, status, is_extra, items(name, unit)')
      .eq('customer_id', bt.customer_id)
      .gte('delivery_date', monthStart)
      .lt('delivery_date', monthEnd)
      .order('delivery_date', { ascending: true });

    const { data: payments } = await admin
      .from('payments')
      .select('amount, payment_date, note')
      .eq('customer_id', bt.customer_id)
      .gte('payment_date', monthStart)
      .lt('payment_date', monthEnd)
      .order('payment_date', { ascending: true });

    const { data: bill } = await admin
      .from('monthly_bills')
      .select('total_amount')
      .eq('customer_id', bt.customer_id)
      .eq('month', monthStart)
      .maybeSingle();

    const totalDelivered = (deliveries ?? [])
      .filter((d) => d.status !== 'skipped')
      .reduce((sum, d) => sum + Number(d.quantity) * Number(d.unit_price), 0);
    const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

    return new Response(
      JSON.stringify({
        shopName: shop?.name ?? 'Your shop',
        customerName: customer.name,
        month: monthStart,
        deliveries: deliveries ?? [],
        payments: payments ?? [],
        totalAmount: bill?.total_amount ?? totalDelivered,
        totalPaid,
        balance: (bill?.total_amount ?? totalDelivered) - totalPaid,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch {
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404,
    });
  }
});
