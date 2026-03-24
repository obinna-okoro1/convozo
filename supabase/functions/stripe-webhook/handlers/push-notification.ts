/**
 * Push Notification Helper
 *
 * Fire-and-forget push notification for a creator.
 * Calls the send-push-notification Edge Function internally.
 * Errors are logged but never allowed to fail the webhook response.
 */
import { supabaseUrl, supabaseServiceKey } from '../../_shared/supabase.ts';

export async function sendPushNotification(
  creatorId: string,
  title: string,
  body: string,
): Promise<void> {
  try {
    const fnUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
    const internalSecret = Deno.env.get('INTERNAL_SECRET') || '';
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        ...(internalSecret ? { 'x-internal-secret': internalSecret } : {}),
      },
      body: JSON.stringify({ creator_id: creatorId, title, body, url: '/creator/dashboard' }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[stripe-webhook] Push notification failed:', res.status, text);
    }
  } catch (err) {
    // Never let push failures break the webhook — payments are processed regardless
    console.error('[stripe-webhook] Push notification error (non-fatal):', (err as Error).message);
  }
}
