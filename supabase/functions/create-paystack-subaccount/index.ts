/**
 * create-paystack-subaccount
 *
 * Registers a creator's bank account as a Paystack subaccount.
 * Called from Settings → Payments when a NG/ZA creator sets up their bank account.
 *
 * What it does:
 *   - Validates the request body (bank_code, account_number, business_name, country)
 *   - Optionally resolves the account name before creation if `resolve_only=true`
 *   - Calls Paystack POST /subaccount to register the bank account
 *   - Upserts the result into the paystack_subaccounts table
 *   - Returns the created/updated subaccount record
 *
 * What it expects (request body):
 *   {
 *     bank_code:       string  — Paystack bank code (e.g. "058" for GTBank Nigeria)
 *     account_number:  string  — Creator's bank account number
 *     business_name:   string  — Creator's display name / business name
 *     country:         string  — ISO country code: 'NG' | 'ZA'
 *     resolve_only?:   boolean — If true, only resolves account name and returns it
 *   }
 *
 * What it returns:
 *   PaystackSubaccount record on success
 *   Or { account_name: string } when resolve_only=true
 *
 * Errors:
 *   400 — Missing/invalid fields
 *   401 — Not authenticated
 *   403 — Creator is not a Paystack country (NG/ZA)
 *   500 — Paystack API error or DB error
 */

import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { jsonOk, jsonError, requireAuth } from '../_shared/http.ts';
import { supabase } from '../_shared/supabase.ts';
import {
  isPaystackCountry,
  createPaystackSubaccount,
  resolvePaystackAccountName,
} from '../_shared/paystack.ts';

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

    if (!isPaystackCountry(country)) {
      return jsonError('Paystack is only available for NG and ZA creators', 403, corsHeaders);
    }

    // If the creator only wants to resolve the account name (validation step in the UI),
    // return the resolved name without creating the subaccount.
    if (resolve_only) {
      const accountName = await resolvePaystackAccountName(account_number, bank_code);
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
    // supabase uses the service role key; we look up by user.id which came from requireAuth
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, payment_provider, country')
      .eq('user_id', user.id)
      .single();

    if (creatorError || !creator) {
      return jsonError('Creator not found', 404, corsHeaders);
    }

    if (!isPaystackCountry((creator.country as string) ?? '')) {
      return jsonError('Your account is not set up for Paystack', 403, corsHeaders);
    }

    const PLATFORM_FEE_PERCENTAGE = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENTAGE') || '22');

    // Create the Paystack subaccount
    const result = await createPaystackSubaccount({
      businessName: business_name,
      bankCode: bank_code,
      accountNumber: account_number,
      platformFeePct: PLATFORM_FEE_PERCENTAGE,
      country: country.toUpperCase(),
    });

    // Resolve account name for display
    let accountName: string | null = null;
    try {
      accountName = await resolvePaystackAccountName(account_number, bank_code);
    } catch {
      // Non-fatal — account_name may be populated by Paystack's create response
      accountName = result.accountName || null;
    }

    // Upsert into paystack_subaccounts (one per creator)
    const { data: subaccount, error: upsertError } = await supabase
      .from('paystack_subaccounts')
      .upsert(
        {
          creator_id: creator.id,
          subaccount_code: result.subaccountCode,
          business_name,
          bank_name: result.bankName,
          bank_code,
          account_number,
          account_name: accountName,
          country: country.toUpperCase(),
          is_verified: result.isVerified,
          is_active: true,
        },
        { onConflict: 'creator_id' },
      )
      .select()
      .single();

    if (upsertError) {
      console.error('[create-paystack-subaccount] DB upsert failed:', upsertError);
      return jsonError('Failed to save subaccount', 500, corsHeaders);
    }

    console.log('[create-paystack-subaccount] Subaccount created for creator:', creator.id, result.subaccountCode);

    return jsonOk(subaccount, corsHeaders);
  } catch (err) {
    const message = (err as Error).message ?? 'Unknown error';
    console.error('[create-paystack-subaccount] Error:', message);

    // Sanitise Paystack API errors before returning them to the client
    if (message.includes('Paystack')) {
      return jsonError(`Bank account setup failed: ${message.replace('Paystack subaccount creation failed: ', '')}`, 400, corsHeaders);
    }

    return jsonError('An internal error occurred. Please try again.', 500, corsHeaders);
  }
});
