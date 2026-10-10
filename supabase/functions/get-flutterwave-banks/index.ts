/**
 * get-flutterwave-banks
 *
 * Returns the list of supported banks for a Flutterwave country, or resolves a bank
 * account number to its registered account name.
 *
 * What it expects (request body):
 *   { country: string }              — list banks for NG or ZA
 *   { resolve: true, account_number: string, bank_code: string }  — resolve account name
 *
 * What it returns:
 *   { banks: FlutterwaveBank[] }         — when listing
 *   { account_name: string }             — when resolving
 *
 * This endpoint is called from Settings → Payments for NG/ZA creators.
 * It is safe to call unauthenticated (bank lists are public information).
 */

import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { jsonOk, jsonError } from '../_shared/http.ts';
import {
  getFlutterwaveBanks,
  resolveFlutterwaveAccountName,
  isFlutterwaveCountry,
} from '../_shared/flutterwave.ts';

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
      // message when Flutterwave rejects the account (wrong number, unrecognised bank code).
      // The outer try/catch handles unexpected system errors separately.
      try {
        const accountName = await resolveFlutterwaveAccountName(account_number, bank_code);
        return jsonOk({ account_name: accountName }, corsHeaders);
      } catch (resolveErr) {
        const resolveMsg = (resolveErr as Error).message ?? '';
        console.error('[get-flutterwave-banks] resolve error:', resolveMsg);
        // Flutterwave rejected the account details — surface the reason as a 422 so the
        // Angular client can distinguish "wrong details" from a system error.
        if (resolveMsg.includes('Flutterwave account resolution failed:')) {
          const reason = resolveMsg.split('Flutterwave account resolution failed:')[1]?.trim() ?? '';
          const userMessage = reason
            ? `Account not found: ${reason}`
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

    if (!isFlutterwaveCountry(country)) {
      return jsonError('Flutterwave payouts are not available in your country', 400, corsHeaders);
    }

    const banks = await getFlutterwaveBanks(country.toUpperCase());
    return jsonOk({ banks }, corsHeaders);

  } catch (err) {
    const message = (err as Error).message ?? 'Unknown error';
    console.error('[get-flutterwave-banks] Error:', message);

    if (message.includes('Flutterwave')) {
      return jsonError(`Flutterwave error: ${message}`, 502, corsHeaders);
    }

    return jsonError('An internal error occurred', 500, corsHeaders);
  }
});
