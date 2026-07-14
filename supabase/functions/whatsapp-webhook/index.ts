// Meta Cloud API webhook: this is the "Callback URL" + "Verify token" the App Dashboard's
// WhatsApp > Configuration screen asks for.
//
// GET  -- the one-time (and repeatable, e.g. on redeploy) handshake Meta uses to confirm
//         you own the URL: it sends hub.mode=subscribe, hub.verify_token, hub.challenge and
//         expects hub.challenge echoed back verbatim if the token matches.
// POST -- the actual event delivery (message status updates, and inbound messages if the
//         number ever accepts replies). Must respond 200 fast; Meta retries with backoff
//         otherwise and can eventually disable the subscription.
//
// verify_jwt is off for this function in config.toml -- Meta calls it unauthenticated, so
// the verify token below (a secret only you and Meta know) is what stands in for auth.
import { adminClient } from '../_shared/clients.ts';

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const expectedToken = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN');

    if (mode === 'subscribe' && expectedToken && token === expectedToken) {
      return new Response(challenge ?? '', { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const admin = adminClient();

      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const value = change.value ?? {};

          // Delivery-status updates for messages we sent (sent/delivered/read/failed).
          for (const status of value.statuses ?? []) {
            const nextStatus = status.status as string;
            if (!['sent', 'delivered', 'read', 'failed'].includes(nextStatus)) continue;
            await admin
              .from('whatsapp_log')
              .update({ status: nextStatus })
              .eq('provider_message_id', status.id);
          }

          // Inbound messages: this app is send-only today (no reply UI/feature), so we
          // just acknowledge receipt rather than persist them anywhere.
        }
      }

      return new Response('EVENT_RECEIVED', { status: 200 });
    } catch {
      // Still 200 -- a malformed payload isn't something Meta should retry indefinitely.
      return new Response('EVENT_RECEIVED', { status: 200 });
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
});
