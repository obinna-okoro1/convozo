/**
 * create-flutterwave-recipient
 *
 * Registers a creator's bank account as a Flutterwave subaccount so that payouts
 * can be automatically split at checkout time.
 * Called from Settings → Payments when a NG/ZA creator sets up their bank account.
 *
 * What it does:
 *   - Validates the request body (bank_code, account_number, business_name, country)
 *   - If `resolve_only=true`, resolves the account name and returns it (validation step in UI)
 *   - Calls Flutterwave POST /subaccounts with split_value: 0.78 (creator gets 78%)
 *   - Upserts the result into flutterwave_subaccounts table
 *   - Returns the created/updated subaccount record
 *
 * Note: Flutterwave subaccounts are immediately active — there is
 * no asynchronous verification step and no `is_verified` field. Subaccounts can be
 * used for splits as soon as they are created.
 *
 * What it expects (request body):
 *   {
 *     bank_code:       string  — Flutterwave bank code (e.g. "058" for GTBank Nigeria)
 *     account_number:  string  — Creator's bank account number
 *     business_name:   string  — Creator's display name / business name
 *     country:         string  — ISO country code: 'NG' | 'ZA'
 *     resolve_only?:   boolean — If true, only resolves account name and returns it
 *   }
 *
 * What it returns:
 *   FlutterwaveSubaccount record on success
 *   Or { account_name: string } when resolve_only=true
 *
 * Errors:
 *   400 — Missing/invalid fields or Flutterwave rejected the account
 *   401 — Not authenticated
 *   403 — Creator is not in a Flutterwave country (NG/ZA)
 *   404 — Creator record not found
 *   500 — Flutterwave API error or DB error
 */

import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { jsonOk, jsonError, requireAuth } from '../_shared/http.ts';
import { supabase } from '../_shared/supabase.ts';
import {
  isFlutterwaveCountry,
  createFlutterwaveSubaccount,
  resolveFlutterwaveAccountName,
} from '../_shared/flutterwave.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  // Require authentication — only the creator can set up their own bank account.
  const user = await requireAuth(req, supabase, corsHeaders);
  if (user instanceof Response) return user;

  try {
    const body: unknown = await req.json();

    if (!body || typeof body !== 'object') {
      return jsonError('Invalid request body', 400, corsHeaders);
    }

    const {
      bank_code,
      account_number,
      business_name,
      country,
      resolve_only,
    } = body as {
      bank_code?: string;
      account_number?: string;
      business_name?: string;
      country?: string;
      resolve_only?: boolean;
    };

    if (!bank_code || !account_number || !country) {
      return jsonError('bank_code, account_number, and country are required', 400, corsHeaders);
    }

    if (!isFlutterwaveCountry(country)) {
      return jsonError('Flutterwave is only available for NG and ZA creators', 403, corsHeaders);
    }

    // If the creator only wants to resolve the account name (validation step in the UI),
    // return the resolved name without creating the subaccount.
    if (resolve_only) {
      const accountName = await resolveFlutterwaveAccountName(account_number, bank_code);
      return jsonOk({ account_name: accountName }, corsHeaders);
    }

    if (!business_name) {
      return jsonError('business_name is required', 400, corsHeaders);
    }

    // Validate account number format: digits only, reasonable length
    if (!/^\d{6,20}$/.test(account_number)) {
      return jsonError('Invalid account number format', 400, corsHeaders);
    }

    // Validate bank code: digits only
    if (!/^\d{2,10}$/.test(bank_code)) {
      return jsonError('Invalid bank code format', 400, corsHeaders);
    }

    // Resolve the authenticated user to find their creator record
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, payment_provider, country')
      .eq('user_id', user.id)
      .single();

    if (creatorError || !creator) {
      return jsonError('Creator not found', 404, corsHeaders);
    }

    if (!isFlutterwaveCountry((creator.country as string) ?? '')) {
      return jsonError('Your account is not set up for Flutterwave', 403, corsHeaders);
    }

    const PLATFORM_FEE_PERCENTAGE = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENTAGE') || '22');
    // Creator's share as a decimal (e.g. 0.78 when platform takes 22%)
    const creatorShareDecimal = (100 - PLATFORM_FEE_PERCENTAGE) / 100;

    // Create the Flutterwave subaccount — this is synchronous and immediately usable.
    const result = await createFlutterwaveSubaccount({
      businessName: business_name,
      bankCode: bank_code,
      accountNumber: account_number,
      country: country.toUpperCase(),
      creatorShareDecimal,
    });

    // Resolve account name for display (best-effort — Flutterwave may already return it)
    let accountName: string | null = result.accountName ?? null;
    if (!accountName) {
      try {
        accountName = await resolveFlutterwaveAccountName(account_number, bank_code);
      } catch {
        // Non-fatal — UI will just not show the resolved name
        accountName = null;
      }
    }

    // Upsert into flutterwave_subaccounts (one record per creator).
    // No is_verified: Flutterwave subaccounts are immediately active.
    const { data: subaccount, error: upsertError } = await supabase
      .from('flutterwave_subaccounts')
      .upsert(
        {
          creator_id: creator.id,
          subaccount_id: result.subaccountId,
          business_name,
          bank_name: result.bankName,
          bank_code,
          account_number,
          account_name: accountName,
          country: country.toUpperCase(),
          is_active: true,
        },
        { onConflict: 'creator_id' },
      )
      .select()
      .single();

    if (upsertError) {
      console.error('[create-flutterwave-recipient] DB upsert failed:', upsertError);
      return jsonError('Failed to save bank account', 500, corsHeaders);
    }

    console.log('[create-flutterwave-recipient] Subaccount created for creator:', creator.id, result.subaccountId);

    return jsonOk(subaccount, corsHeaders);
  } catch (err) {
    const message = (err as Error).message ?? 'Unknown error';
    console.error('[create-flutterwave-recipient] Error:', message);

    // Sanitise Flutterwave API errors before returning them to the client
    if (message.includes('Flutterwave')) {
      return jsonError(
        `Bank account setup failed: ${message.replace('Flutterwave subaccount creation failed: ', '')}`,
        400,
        corsHeaders,
      );
    }

    return jsonError('An internal error occurred. Please try again.', 500, corsHeaders);
  }
});
