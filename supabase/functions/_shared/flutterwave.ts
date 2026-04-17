/**
 * Shared Flutterwave v3 client helpers for Convozo Edge Functions.
 *
 * Flutterwave has no official Deno SDK, so we use fetch directly against their REST API.
 * All monetary amounts in this codebase are in integer cents (USD subunits). Flutterwave
 * amounts are in full currency units (e.g. 10.00 for $10), so we convert at the boundary.
 *
 * Countries supported by this integration:
 *   NG — Nigeria
 *   ZA — South Africa
 *
 * Split model:
 *   Creator (subaccount) receives 78% of each transaction via Flutterwave's subaccount split.
 *   Platform (main account) keeps 22%. split_value = 0.78 is set at subaccount creation time.
 *   The merchant_bears_cost flag ensures Flutterwave's processing fee comes out of the platform cut.
 *
 * Webhook security:
 *   Flutterwave v3 sends the raw FLW_SECRET_HASH as the `verif-hash` header.
 *   We compare using a timing-safe XOR loop to prevent timing attacks.
 *
 * Usage:
 *   import { initializeFlutterwavePayment, verifyFlutterwaveSignature } from '../_shared/flutterwave.ts';
 */

const FLW_BASE_URL = 'https://api.flutterwave.com/v3';
const FLW_SECRET_KEY = Deno.env.get('FLW_SECRET_KEY') ?? '';
const FLW_SECRET_HASH = Deno.env.get('FLW_SECRET_HASH') ?? '';

/** Countries that use Flutterwave instead of Stripe. */
export const FLUTTERWAVE_COUNTRIES = new Set(['NG', 'ZA']);

export function isFlutterwaveCountry(countryIso: string): boolean {
  return FLUTTERWAVE_COUNTRIES.has(countryIso.toUpperCase());
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FlutterwavePaymentParams {
  /** Client email address */
  email: string;
  /** Client display name */
  customerName: string;
  /** Amount in USD cents (integer). Converted to full dollars before sending to Flutterwave. */
  amountCents: number;
  /** Creator's Flutterwave subaccount ID e.g. RS_xxxxxx */
  subaccountId: string;
  /** URL to redirect client after payment */
  redirectUrl: string;
  /** Unique transaction reference (used for idempotency + webhook lookup) */
  txRef: string;
  /** Metadata to embed in the transaction (recovered in the webhook via data.meta) */
  metadata: Record<string, string>;
}

export interface FlutterwavePaymentResult {
  checkoutUrl: string;
  txRef: string;
}

export interface FlutterwaveSubaccountParams {
  businessName: string;
  bankCode: string;
  accountNumber: string;
  /** Creator receives (1 - platformFeePct/100) — e.g. 0.78 for 22% platform fee. */
  creatorShareDecimal: number;
  country: string; // 'NG' | 'ZA'
}

export interface FlutterwaveSubaccountResult {
  subaccountId: string;  // e.g. RS_xxxxxx
  bankName: string;
  accountName: string | null;
}

export interface FlutterwaveTransactionData {
  id: number;
  status: string;          // 'successful' | 'failed' | 'pending'
  txRef: string;
  amountCents: number;     // converted from full units to integer cents
  currency: string;
  meta: Record<string, string>;
}

export interface FlutterwaveBank {
  name: string;
  code: string;
}

// ── Initialize Payment ─────────────────────────────────────────────────────────

/**
 * Create a Flutterwave hosted checkout session and return the payment URL.
 *
 * The creator (subaccount) receives their share automatically at settlement time
 * based on the split_value set when the subaccount was created (78%).
 * merchant_bears_cost=true ensures Flutterwave fees come out of the platform cut.
 *
 * Amount conversion: amountCents / 100 → full USD units for Flutterwave.
 *
 * @throws Error if the Flutterwave API returns a non-success response.
 */
export async function initializeFlutterwavePayment(
  params: FlutterwavePaymentParams,
): Promise<FlutterwavePaymentResult> {
  const body = {
    tx_ref: params.txRef,
    // Convert integer cents to full currency units (e.g. 1000 cents → 10.00 USD)
    amount: params.amountCents / 100,
    currency: 'USD',
    redirect_url: params.redirectUrl,
    customer: {
      email: params.email,
      name: params.customerName,
    },
    subaccounts: [{ id: params.subaccountId }],
    meta: params.metadata,
    // Platform bears Flutterwave's processing fee so it comes out of our 22% cut,
    // not the creator's 78% share.
    merchant_bears_cost: true,
  };

  const res = await fetch(`${FLW_BASE_URL}/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FLW_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json() as {
    status: string;
    message: string;
    data?: { link: string };
  };

  if (json.status !== 'success' || !json.data?.link) {
    throw new Error(`Flutterwave payment initialization failed: ${json.message}`);
  }

  return {
    checkoutUrl: json.data.link,
    txRef: params.txRef,
  };
}

// ── Create Subaccount ──────────────────────────────────────────────────────────

/**
 * Register a creator's bank account as a Flutterwave subaccount.
 *
 * split_value = creatorShareDecimal (e.g. 0.78) — creator receives this fraction of each charge.
 * The platform implicitly keeps (1 - split_value).
 *
 * @throws Error if the Flutterwave API returns a non-success response.
 */
export async function createFlutterwaveSubaccount(
  params: FlutterwaveSubaccountParams,
): Promise<FlutterwaveSubaccountResult> {
  const body = {
    account_bank: params.bankCode,
    account_number: params.accountNumber,
    business_name: params.businessName,
    split_type: 'percentage',
    // Flutterwave split_value is a decimal fraction: 0.78 = creator gets 78%
    split_value: params.creatorShareDecimal,
    country: params.country.toUpperCase(),
  };

  const res = await fetch(`${FLW_BASE_URL}/subaccounts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FLW_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json() as {
    status: string;
    message: string;
    data?: {
      subaccount_id: string;
      bank_name: string;
      account_number: string;
    };
  };

  if (json.status !== 'success' || !json.data) {
    throw new Error(`Flutterwave subaccount creation failed: ${json.message}`);
  }

  return {
    subaccountId: json.data.subaccount_id,
    bankName: json.data.bank_name,
    accountName: null, // resolved separately via resolveFlutterwaveAccountName
  };
}

// ── Verify Transaction ─────────────────────────────────────────────────────────

/**
 * Verify a transaction by Flutterwave's internal transaction ID.
 * Called as a secondary safety check inside the webhook handler to prevent replay attacks.
 *
 * IMPORTANT: Flutterwave uses a numeric transaction ID (data.id in the webhook payload),
 * NOT the tx_ref string, for verification. Always use data.id from the webhook.
 *
 * Amount conversion: Flutterwave returns full units → multiply by 100 to get cents.
 */
export async function verifyFlutterwaveTransaction(
  transactionId: number,
): Promise<FlutterwaveTransactionData> {
  const res = await fetch(`${FLW_BASE_URL}/transactions/${transactionId}/verify`, {
    headers: {
      Authorization: `Bearer ${FLW_SECRET_KEY}`,
    },
  });

  const json = await res.json() as {
    status: string;
    message: string;
    data?: {
      id: number;
      status: string;
      tx_ref: string;
      amount: number;
      currency: string;
      meta: Record<string, string> | null;
    };
  };

  if (json.status !== 'success' || !json.data) {
    throw new Error(`Flutterwave transaction verify failed: ${json.message}`);
  }

  return {
    id: json.data.id,
    status: json.data.status,
    txRef: json.data.tx_ref,
    // Convert full currency units back to integer cents
    amountCents: Math.round(json.data.amount * 100),
    currency: json.data.currency,
    meta: json.data.meta ?? {},
  };
}

// ── Bank List ──────────────────────────────────────────────────────────────────

/**
 * Fetch the complete list of banks available for a given country.
 *
 * Flutterwave uses ISO country codes directly (e.g. 'NG', 'ZA') — no name mapping needed.
 *
 * @param country ISO country code: 'NG' | 'ZA'
 */
export async function getFlutterwaveBanks(country: string): Promise<FlutterwaveBank[]> {
  const code = country.toUpperCase();
  if (!FLUTTERWAVE_COUNTRIES.has(code)) {
    throw new Error(`Unsupported Flutterwave country: ${country}`);
  }

  const res = await fetch(`${FLW_BASE_URL}/banks/${encodeURIComponent(code)}`, {
    headers: {
      Authorization: `Bearer ${FLW_SECRET_KEY}`,
    },
  });

  const json = await res.json() as {
    status: string;
    message: string;
    data?: Array<{ id: number; code: string; name: string }>;
  };

  if (json.status !== 'success' || !json.data) {
    throw new Error(`Flutterwave bank list failed: ${json.message}`);
  }

  return json.data.map((b) => ({
    name: b.name,
    code: b.code,
  }));
}

// ── Account Name Resolution ────────────────────────────────────────────────────

/**
 * Resolve a bank account number to the registered account holder name.
 * Shown to the creator before they confirm their bank setup in Settings.
 *
 * @throws Error if Flutterwave rejects the account (wrong number, unrecognised bank).
 */
export async function resolveFlutterwaveAccountName(
  accountNumber: string,
  bankCode: string,
): Promise<string> {
  const url = `${FLW_BASE_URL}/accounts/resolve?account_number=${encodeURIComponent(accountNumber)}&account_bank=${encodeURIComponent(bankCode)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${FLW_SECRET_KEY}`,
    },
  });

  const json = await res.json() as {
    status: string;
    message: string;
    data?: { account_number: string; account_name: string };
  };

  if (json.status !== 'success' || !json.data) {
    throw new Error(`Flutterwave account resolution failed: ${json.message}`);
  }

  return json.data.account_name;
}

// ── Webhook Signature Verification ────────────────────────────────────────────

/**
 * Verify the Flutterwave webhook signature.
 *
 * Flutterwave v3 sends the raw FLW_SECRET_HASH you set in the dashboard as the
 * `verif-hash` request header. We compare using a timing-safe XOR loop to prevent
 * timing side-channel attacks.
 *
 * @param signature  The value of the `verif-hash` header.
 * @returns true if the signature matches the configured FLW_SECRET_HASH.
 */
export function verifyFlutterwaveSignature(signature: string): boolean {
  if (!FLW_SECRET_HASH || !signature) return false;
  if (signature.length !== FLW_SECRET_HASH.length) return false;

  // Timing-safe comparison using XOR to prevent timing attacks
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ FLW_SECRET_HASH.charCodeAt(i);
  }
  return mismatch === 0;
}
