/**
 * get-paystack-banks
 *
 * Returns the list of supported banks for a Paystack country, or resolves a bank
 * account number to its registered account name.
 *
 * What it expects (request body):
 *   { country: string }              — list banks for NG or ZA
 *   { resolve: true, account_number: string, bank_code: string }  — resolve account name
 *
 * What it returns:
 *   { banks: PaystackBank[] }            — when listing
 *   { account_name: string }             — when resolving
 *
 * This endpoint is called from Settings → Payments for NG/ZA creators.
 * It is safe to call unauthenticated (bank lists are public information).
 */

import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { jsonOk, jsonError } from '../_shared/http.ts';
import { getPaystackBanks, resolvePaystackAccountName, isPaystackCountry } from '../_shared/paystack.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== 'object') {
      return jsonError('Invalid request body', 400, corsHeaders);
    }

    const { country, resolve, account_number, bank_code } = body as {
      country?: string;
      resolve?: boolean;
      account_number?: string;
      bank_code?: string;
    };

    // ── Account name resolution ─────────────────────────────────────────────
    if (resolve) {
      if (!account_number || !bank_code) {
        return jsonError('account_number and bank_code are required for resolve', 400, corsHeaders);
      }

      if (!/^\d{6,20}$/.test(account_number)) {
        return jsonError('Invalid account number format', 400, corsHeaders);
      }

      // Wrap the resolve call separately so we can return a 422 with a user-friendly
      // message when Paystack rejects the account (wrong number, unrecognised bank code).
      // The outer try/catch handles unexpected system errors separately.
      try {
        const accountName = await resolvePaystackAccountName(account_number, bank_code);
        return jsonOk({ account_name: accountName }, corsHeaders);
      } catch (resolveErr) {
        const resolveMsg = (resolveErr as Error).message ?? '';
        console.error('[get-paystack-banks] resolve error:', resolveMsg);
        // Paystack rejected the account details — surface the reason as a 422 so the
        // Angular client can distinguish "wrong details" from a system error.
        if (resolveMsg.includes('Paystack account resolution failed:')) {
          const paystackReason = resolveMsg.split('Paystack account resolution failed:')[1]?.trim() ?? '';
          const userMessage = paystackReason
            ? `Account not found: ${paystackReason}`
            : 'Account not found. Please verify your account number and bank.';
          return jsonError(userMessage, 422, corsHeaders);
        }
        return jsonError('An internal error occurred', 500, corsHeaders);
      }
    }

    // ── Bank list ───────────────────────────────────────────────────────────
    if (!country) {
      return jsonError('country is required', 400, corsHeaders);
    }

    if (!isPaystackCountry(country)) {
      return jsonError('Paystack is only available for NG and ZA', 400, corsHeaders);
    }

    const banks = await getPaystackBanks(country.toUpperCase());
    return jsonOk({ banks }, corsHeaders);

  } catch (err) {
    const message = (err as Error).message ?? 'Unknown error';
    console.error('[get-paystack-banks] Error:', message);

    if (message.includes('Paystack')) {
      return jsonError(`Paystack error: ${message}`, 502, corsHeaders);
    }

    return jsonError('An internal error occurred', 500, corsHeaders);
  }
});
