/**
 * Shared Paystack client helpers for Convozo Edge Functions.
 *
 * Paystack has no official Deno SDK, so we use fetch directly against their REST API.
 * All monetary amounts are in integer cents (USD subunits) — the same unit used throughout
 * the Convozo codebase.
 *
 * Paystack countries supported by this integration:
 *   NG — Nigeria  (currency: USD, settled to NGN bank accounts)
 *   ZA — South Africa (currency: USD, settled to ZAR bank accounts)
 *
 * Split model:
 *   Creator (subaccount) receives 78% of each transaction via dynamic split.
 *   Platform (main account) keeps 22%. The platform bears Paystack fees.
 *
 * Usage:
 *   import { initializePaystackTransaction, verifyPaystackSignature } from '../_shared/paystack.ts';
 */

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

/** Countries that use Paystack instead of Stripe. */
export const PAYSTACK_COUNTRIES = new Set(['NG', 'ZA']);

export function isPaystackCountry(countryIso: string): boolean {
  return PAYSTACK_COUNTRIES.has(countryIso.toUpperCase());
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PaystackInitializeParams {
  /** Fan email address */
  email: string;
  /** Amount in USD cents (integer). Paystack amount = cents directly for USD. */
  amountCents: number;
  /** Creator's Paystack subaccount code e.g. ACCT_xxxxxx */
  subaccountCode: string;
  /** Platform fee percentage (22). Creator gets (100 - platformFeePct)%. */
  platformFeePct: number;
  /** URL to redirect fan after payment */
  callbackUrl: string;
  /** Unique reference for this transaction (used for idempotency + webhook lookup) */
  reference: string;
  /** Metadata to embed in the transaction (recovered in the webhook) */
  metadata: Record<string, string>;
}

export interface PaystackInitializeResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface PaystackSubaccountParams {
  businessName: string;
  bankCode: string;
  accountNumber: string;
  /** Platform keeps this percentage (22). Creator is the subaccount. */
  platformFeePct: number;
  country: string; // 'NG' | 'ZA'
}

export interface PaystackSubaccountResult {
  subaccountCode: string;
  bankName: string;
  accountName: string;
  isVerified: boolean;
}

// ── Initialize Transaction ─────────────────────────────────────────────────────

/**
 * Create a Paystack checkout transaction and return the hosted payment URL.
 *
 * Uses a dynamic split so the creator (subaccount) receives (100 - platformFeePct)%
 * automatically at settlement time. Platform (main account) keeps platformFeePct%.
 *
 * @throws Error if the Paystack API returns a non-success response.
 */
export async function initializePaystackTransaction(
  params: PaystackInitializeParams,
): Promise<PaystackInitializeResult> {
  const creatorShare = 100 - params.platformFeePct; // 78

  const body = {
    email: params.email,
    amount: params.amountCents, // USD cents → Paystack treats as subunit of USD
    currency: 'USD',
    reference: params.reference,
    callback_url: params.callbackUrl,
    // Dynamic split: creator gets creatorShare%, platform keeps platformFeePct%
    split: {
      type: 'percentage',
      bearer_type: 'account', // platform (main account) bears Paystack fees
      subaccounts: [
        {
          subaccount: params.subaccountCode,
          share: creatorShare,
        },
      ],
    },
    metadata: {
      custom_fields: Object.entries(params.metadata).map(([key, value]) => ({
        display_name: key,
        variable_name: key,
        value,
      })),
    },
  };

  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json() as {
    status: boolean;
    message: string;
    data?: { authorization_url: string; access_code: string; reference: string };
  };

  if (!json.status || !json.data) {
    throw new Error(`Paystack initialization failed: ${json.message}`);
  }

  return {
    authorizationUrl: json.data.authorization_url,
    accessCode: json.data.access_code,
    reference: json.data.reference,
  };
}

// ── Create Subaccount ──────────────────────────────────────────────────────────

/**
 * Register a creator's bank account as a Paystack subaccount.
 * The platform (main account) is configured to keep platformFeePct% of each transaction.
 *
 * @throws Error if the Paystack API returns a non-success response.
 */
export async function createPaystackSubaccount(
  params: PaystackSubaccountParams,
): Promise<PaystackSubaccountResult> {
  const body = {
    business_name: params.businessName,
    settlement_bank: params.bankCode,
    account_number: params.accountNumber,
    // percentage_charge = what the MAIN account (platform) receives.
    percentage_charge: params.platformFeePct,
    primary_contact_email: '', // optional
  };

  const res = await fetch(`${PAYSTACK_BASE_URL}/subaccount`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json() as {
    status: boolean;
    message: string;
    data?: {
      subaccount_code: string;
      settlement_bank: string;
      account_name: string;
      is_verified: boolean;
    };
  };

  if (!json.status || !json.data) {
    throw new Error(`Paystack subaccount creation failed: ${json.message}`);
  }

  return {
    subaccountCode: json.data.subaccount_code,
    bankName: json.data.settlement_bank,
    accountName: json.data.account_name,
    isVerified: json.data.is_verified,
  };
}

// ── Verify Transaction ─────────────────────────────────────────────────────────

export interface PaystackTransactionData {
  status: string;          // 'success' | 'failed' | 'abandoned'
  reference: string;
  amount: number;          // in subunits
  currency: string;
  paidAt: string;
  metadata: {
    custom_fields?: Array<{ variable_name: string; value: string }>;
  };
}

/**
 * Verify a transaction by reference — used as an additional safety check in the webhook.
 * Never skip this when processing charge.success events.
 */
export async function verifyPaystackTransaction(
  reference: string,
): Promise<PaystackTransactionData> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    },
  });

  const json = await res.json() as {
    status: boolean;
    message: string;
    data?: {
      status: string;
      reference: string;
      amount: number;
      currency: string;
      paid_at: string;
      metadata: { custom_fields?: Array<{ variable_name: string; value: string }> };
    };
  };

  if (!json.status || !json.data) {
    throw new Error(`Paystack verify failed: ${json.message}`);
  }

  return {
    status: json.data.status,
    reference: json.data.reference,
    amount: json.data.amount,
    currency: json.data.currency,
    paidAt: json.data.paid_at,
    metadata: json.data.metadata,
  };
}

// ── Bank List ──────────────────────────────────────────────────────────────────

export interface PaystackBank {
  name: string;
  code: string;
  country: string;
  currency: string;
}

/**
 * Paystack's bank list API requires the full country name, not the ISO code.
 * e.g. 'nigeria' not 'ng', 'south%20africa' not 'za'.
 */
const PAYSTACK_COUNTRY_NAMES: Record<string, string> = {
  NG: 'nigeria',
  ZA: 'south africa',
};

/**
 * Fetch the list of banks available for a given country.
 * Used by the creator settings UI to populate the bank picker.
 *
 * @param country ISO country code: 'NG' | 'ZA'
 */
export async function getPaystackBanks(country: string): Promise<PaystackBank[]> {
  const countryName = PAYSTACK_COUNTRY_NAMES[country.toUpperCase()];
  if (!countryName) {
    throw new Error(`Unsupported Paystack country: ${country}`);
  }
  const res = await fetch(
    `${PAYSTACK_BASE_URL}/bank?country=${encodeURIComponent(countryName)}&use_cursor=false&perPage=100`,
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    },
  );

  const json = await res.json() as {
    status: boolean;
    message: string;
    data?: Array<{ name: string; code: string; country: string; currency: string }>;
  };

  if (!json.status || !json.data) {
    throw new Error(`Paystack bank list failed: ${json.message}`);
  }

  return json.data.map((b) => ({
    name: b.name,
    code: b.code,
    country: b.country,
    currency: b.currency,
  }));
}

/**
 * Resolve a bank account number to the registered account name.
 * Shown to the creator before they confirm their bank setup.
 */
export async function resolvePaystackAccountName(
  accountNumber: string,
  bankCode: string,
): Promise<string> {
  const res = await fetch(
    `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    },
  );

  const json = await res.json() as {
    status: boolean;
    message: string;
    data?: { account_name: string; account_number: string };
  };

  if (!json.status || !json.data) {
    throw new Error(`Account resolution failed: ${json.message}`);
  }

  return json.data.account_name;
}

// ── Webhook Signature Verification ────────────────────────────────────────────

/**
 * Verify the Paystack webhook signature.
 *
 * Paystack signs webhook payloads with HMAC-SHA512 using the secret key.
 * The signature is in the `x-paystack-signature` request header.
 *
 * @param rawBody   The raw request body bytes (must be the original bytes, not re-serialised).
 * @param signature The value of the `x-paystack-signature` header.
 * @returns true if the signature is valid, false otherwise.
 */
export async function verifyPaystackSignature(
  rawBody: Uint8Array,
  signature: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(PAYSTACK_SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );

  // Cast to ArrayBuffer — Uint8Array is ArrayBufferView but some TS environments only accept ArrayBuffer here.
  const signatureBytes = await crypto.subtle.sign('HMAC', key, rawBody as unknown as ArrayBuffer);
  const hex = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return hex === signature;
}
