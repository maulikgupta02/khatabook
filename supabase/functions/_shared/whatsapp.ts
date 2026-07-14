// Wraps the official Meta WhatsApp Cloud API (graph.facebook.com), not Twilio and not
// wa.me links, per the project's stack decision. Every call is logged to whatsapp_log
// regardless of outcome. If WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID aren't set
// (no real Meta Business account configured yet), this logs the exact payload that
// would have been sent with status 'queued' instead of calling the network -- so the
// request shape can be verified end-to-end before real credentials exist.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export async function sendWhatsApp(
  admin: SupabaseClient,
  opts: {
    shopId: string;
    customerId: string | null;
    to: string;
    templateName: string;
    bodyParams: string[];
  }
) {
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const apiVersion = Deno.env.get('WHATSAPP_API_VERSION') ?? 'v22.0';

  const payload = {
    messaging_product: 'whatsapp',
    to: opts.to,
    type: 'template',
    template: {
      name: opts.templateName,
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: opts.bodyParams.map((text) => ({ type: 'text', text })),
        },
      ],
    },
  };

  let status: 'queued' | 'sent' | 'failed' = 'queued';
  let providerMessageId: string | null = null;
  let error: string | null = null;

  if (phoneNumberId && accessToken) {
    try {
      const resp = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const respBody = await resp.json().catch(() => null);
      if (resp.ok) {
        status = 'sent';
        providerMessageId = respBody?.messages?.[0]?.id ?? null;
      } else {
        status = 'failed';
        error = respBody?.error?.message ?? `Meta API returned HTTP ${resp.status}`;
      }
    } catch (e) {
      status = 'failed';
      error = e instanceof Error ? e.message : 'Network error calling Meta Cloud API';
    }
  } else {
    error = 'WhatsApp not configured yet (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID) -- logged only.';
  }

  await admin.from('whatsapp_log').insert({
    shop_id: opts.shopId,
    customer_id: opts.customerId,
    template_name: opts.templateName,
    payload,
    status,
    provider_message_id: providerMessageId,
    error,
  });

  return { status, error };
}
