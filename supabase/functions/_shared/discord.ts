// Fire-and-forget Discord webhook logger. No-ops if DISCORD_WEBHOOK_URL isn't set, and never
// throws -- a logging failure must not affect the caller's response to Meta/Supabase.
export async function logToDiscord(content: string) {
  const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL');
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.slice(0, 2000) }),
    });
  } catch {
    // best-effort only
  }
}
