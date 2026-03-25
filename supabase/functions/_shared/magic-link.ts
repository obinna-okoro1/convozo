/**
 * _shared/magic-link.ts
 *
 * Generates a Supabase magic-link that authenticates the client and redirects
 * them to the /portal page after clicking.
 *
 * Uses the service-role Supabase client (admin API) — must only be called
 * from Edge Functions, never from client-side code.
 *
 * Returns:
 *   - The one-time magic link URL string on success
 *   - null if generation fails (non-fatal — callers should still send the
 *     email without the portal CTA rather than aborting the whole operation)
 */

import { supabase } from './supabase.ts';
import { getAppUrl } from './http.ts';

/**
 * Generates a Supabase magic link for `email` that redirects to /portal.
 *
 * @param email - The client's email address (sender_email / booker_email)
 * @returns The action link URL, or null if generation failed
 */
export async function generateMagicLink(email: string): Promise<string | null> {
  const redirectTo = `${getAppUrl()}/portal`;

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  });

  if (error || !data?.properties?.action_link) {
    console.error('[magic-link] Failed to generate link for', email, error);
    return null;
  }

  return data.properties.action_link;
}
