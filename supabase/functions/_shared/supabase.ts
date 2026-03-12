/**
 * Shared Supabase admin client for Convozo Edge Functions.
 *
 * Uses the service-role key so functions can bypass RLS where needed.
 * Import this instead of repeating the three-line setup in every function.
 *
 * Usage:
 *   import { supabase, supabaseUrl, supabaseServiceKey } from '../_shared/supabase.ts';
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

// Support both the canonical auto-injected name and the legacy alias.
export const supabaseServiceKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '';

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
