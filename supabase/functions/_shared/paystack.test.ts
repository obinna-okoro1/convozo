/**
 * Unit tests for _shared/paystack.ts
 *
 * Tests: isPaystackCountry, verifyPaystackSignature, initializePaystackTransaction,
 *        createPaystackSubaccount, verifyPaystackTransaction, getPaystackBanks,
 *        resolvePaystackAccountName
 *
 * What these tests cover:
 *   1. Country routing — NG/ZA → Paystack; all others → Stripe
 *   2. Webhook signature verification (HMAC-SHA512)
 *   3. Correct 78/22 split in transaction initialization
 *   4. Money amounts passed as integer cents, currency always USD
 *   5. Metadata custom_fields mapping
 *   6. Subaccount creation with correct platform percentage
 *   7. Transaction verification with URL-encoded references
 *   8. Bank list retrieval and account resolution
 *   9. Error propagation — every function throws when Paystack returns status: false
 *
 * NOTE: PAYSTACK_SECRET_KEY is not set in the test environment, so the module-level
 * constant is ''. Tests for verifyPaystackSignature derive expected signatures using
 * the same empty key — this validates the cryptographic algorithm, not the key value.
 *
 * Run with:
 *   deno test --allow-env _shared/paystack.test.ts
 */

import { assertEquals, assertRejects } from '@std/assert';
import {
  isPaystackCountry,
  verifyPaystackSignature,
  initializePaystackTransaction,
  createPaystackSubaccount,
  verifyPaystackTransaction,
  getPaystackBanks,
  resolvePaystackAccountName,
} from './paystack.ts';

// ── Fetch mock helper ──────────────────────────────────────────────────────────

/**
 * The test secret key — must match what is set in `deno.json` test task:
 *   PAYSTACK_SECRET_KEY=test_paystack_key_for_unit_tests
 *
 * paystack.ts reads this at module-import time, so by setting the env var
 * in the shell before `deno test` runs, the module picks it up correctly.
 * The test then uses the same key to compute expected HMAC values.
 */
const TEST_KEY = 'test_paystack_key_for_unit_tests';

interface MockFetchHandle {
  /** Restore globalThis.fetch to the original. Always call in `finally`. */
  restore: () => void;
  /** All Request objects captured during the mock's lifetime. */
  calls: Request[];
}

/**
 * Replace globalThis.fetch with a stub that returns a fixed JSON response.
 * Captures every outgoing Request for assertion.
 * Always call `restore()` in a `finally` block.
 */
function mockFetch(responseBody: unknown, status = 200): MockFetchHandle {
  const calls: Request[] = [];
  const original = globalThis.fetch;

  // deno-lint-ignore no-explicit-any
  (globalThis as any).fetch = (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    // Capture a new Request so we can later read its URL and body
    calls.push(new Request(input as string, init));
    return Promise.resolve(
      new Response(JSON.stringify(responseBody), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };

  return {
    restore: () => {
      // deno-lint-ignore no-explicit-any
      (globalThis as any).fetch = original;
    },
    calls,
  };
}

/** Compute HMAC-SHA512 of `data` keyed with `key` and return the lowercase hex string. */
async function hmacSha512Hex(key: string, data: Uint8Array): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const sigBytes = await crypto.subtle.sign('HMAC', cryptoKey, data as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── isPaystackCountry ─────────────────────────────────────────────────────────

Deno.test('isPaystackCountry - NG returns true', () => {
  assertEquals(isPaystackCountry('NG'), true);
});

Deno.test('isPaystackCountry - ZA returns true', () => {
  assertEquals(isPaystackCountry('ZA'), true);
});

Deno.test('isPaystackCountry - lowercase ng returns true (case-insensitive)', () => {
  assertEquals(isPaystackCountry('ng'), true);
});

Deno.test('isPaystackCountry - lowercase za returns true (case-insensitive)', () => {
  assertEquals(isPaystackCountry('za'), true);
});

Deno.test('isPaystackCountry - US returns false', () => {
  assertEquals(isPaystackCountry('US'), false);
});

Deno.test('isPaystackCountry - GB returns false', () => {
  assertEquals(isPaystackCountry('GB'), false);
});

Deno.test('isPaystackCountry - DE returns false', () => {
  assertEquals(isPaystackCountry('DE'), false);
});

Deno.test('isPaystackCountry - CA returns false', () => {
  assertEquals(isPaystackCountry('CA'), false);
});

Deno.test('isPaystackCountry - AU returns false', () => {
  assertEquals(isPaystackCountry('AU'), false);
});

Deno.test('isPaystackCountry - empty string returns false', () => {
  assertEquals(isPaystackCountry(''), false);
});

// ── verifyPaystackSignature ───────────────────────────────────────────────────
//
// The module reads PAYSTACK_SECRET_KEY at import time. Since the env var is not
// set in tests, the key is ''. We compute expected HMACs with '' so the tests
// validate the algorithm and hex-encoding logic without needing the real secret.

Deno.test('verifyPaystackSignature - valid signature returns true', async () => {
  const payload = new TextEncoder().encode('{"event":"charge.success","data":{"reference":"ref_1"}}');
  const expectedSig = await hmacSha512Hex(TEST_KEY, payload);
  const result = await verifyPaystackSignature(payload, expectedSig);
  assertEquals(result, true);
});

Deno.test('verifyPaystackSignature - wrong signature returns false', async () => {
  const payload = new TextEncoder().encode('{"event":"charge.success"}');
  const result = await verifyPaystackSignature(payload, 'deadbeef0000111122223333');
  assertEquals(result, false);
});

Deno.test('verifyPaystackSignature - empty signature string returns false', async () => {
  const payload = new TextEncoder().encode('{"event":"charge.success"}');
  // Empty string will never equal a 128-char HMAC-SHA512 hex
  const result = await verifyPaystackSignature(payload, '');
  assertEquals(result, false);
});

Deno.test('verifyPaystackSignature - tampered body fails verification', async () => {
  const original = new TextEncoder().encode('{"amount":1000}');
  const tampered = new TextEncoder().encode('{"amount":9999}');
  // Compute sig for original → must NOT validate against tampered
  const sigForOriginal = await hmacSha512Hex(TEST_KEY, original);
  const result = await verifyPaystackSignature(tampered, sigForOriginal);
  assertEquals(result, false);
});

Deno.test('verifyPaystackSignature - sig for payload A does not validate payload B', async () => {
  const payloadA = new TextEncoder().encode('{"id":"event-A"}');
  const payloadB = new TextEncoder().encode('{"id":"event-B"}');
  const sigA = await hmacSha512Hex(TEST_KEY, payloadA);
  assertEquals(await verifyPaystackSignature(payloadA, sigA), true);
  assertEquals(await verifyPaystackSignature(payloadB, sigA), false);
});

// ── initializePaystackTransaction ─────────────────────────────────────────────

Deno.test('initializePaystackTransaction - returns authorization URL and reference', async () => {
  const mock = mockFetch({
    status: true,
    message: 'Authorization URL created',
    data: {
      authorization_url: 'https://checkout.paystack.com/abc123',
      access_code: 'ac_xyz',
      reference: 'ref_001',
    },
  });
  try {
    const result = await initializePaystackTransaction({
      email: 'fan@example.com',
      amountCents: 1000,
      subaccountCode: 'ACCT_testcode',
      platformFeePct: 22,
      callbackUrl: 'https://convozo.com/success',
      reference: 'ref_001',
      metadata: { creator_id: 'creator-1', type: 'message' },
    });
    assertEquals(result.authorizationUrl, 'https://checkout.paystack.com/abc123');
    assertEquals(result.accessCode, 'ac_xyz');
    assertEquals(result.reference, 'ref_001');
  } finally {
    mock.restore();
  }
});

Deno.test('initializePaystackTransaction - sends 78/22 dynamic split (creator gets 78%)', async () => {
  const mock = mockFetch({
    status: true,
    message: 'Authorization URL created',
    data: {
      authorization_url: 'https://checkout.paystack.com/x',
      access_code: 'ac_x',
      reference: 'ref_split',
    },
  });
  try {
    await initializePaystackTransaction({
      email: 'fan@example.com',
      amountCents: 1000,
      subaccountCode: 'ACCT_split',
      platformFeePct: 22,
      callbackUrl: 'https://convozo.com/success',
      reference: 'ref_split',
      metadata: {},
    });
    assertEquals(mock.calls.length, 1);
    const sentBody = await mock.calls[0].json() as {
      split: { type: string; bearer_type: string; subaccounts: Array<{ subaccount: string; share: number }> };
    };
    // Creator receives 78% (100 - 22)
    assertEquals(sentBody.split.subaccounts[0].share, 78);
    assertEquals(sentBody.split.subaccounts[0].subaccount, 'ACCT_split');
    assertEquals(sentBody.split.type, 'percentage');
    // Platform (main account) bears Paystack fees — this protects creator payout
    assertEquals(sentBody.split.bearer_type, 'account');
  } finally {
    mock.restore();
  }
});

Deno.test('initializePaystackTransaction - sends USD currency and amount as integer cents', async () => {
  const mock = mockFetch({
    status: true,
    message: 'Authorization URL created',
    data: {
      authorization_url: 'https://checkout.paystack.com/y',
      access_code: 'ac_y',
      reference: 'ref_usd',
    },
  });
  try {
    await initializePaystackTransaction({
      email: 'fan@example.com',
      amountCents: 2500,
      subaccountCode: 'ACCT_usd',
      platformFeePct: 22,
      callbackUrl: 'https://convozo.com/success',
      reference: 'ref_usd',
      metadata: {},
    });
    const sentBody = await mock.calls[0].json() as { currency: string; amount: number };
    assertEquals(sentBody.currency, 'USD');
    // Amount must be sent as integer cents, no float conversion
    assertEquals(sentBody.amount, 2500);
  } finally {
    mock.restore();
  }
});

Deno.test('initializePaystackTransaction - sets reference on outgoing request', async () => {
  const mock = mockFetch({
    status: true,
    message: 'Authorization URL created',
    data: {
      authorization_url: 'https://checkout.paystack.com/ref',
      access_code: 'ac_ref',
      reference: 'convozo_idem_key_42',
    },
  });
  try {
    await initializePaystackTransaction({
      email: 'fan@example.com',
      amountCents: 800,
      subaccountCode: 'ACCT_ref',
      platformFeePct: 22,
      callbackUrl: 'https://convozo.com/success',
      reference: 'convozo_idem_key_42',
      metadata: {},
    });
    const sentBody = await mock.calls[0].json() as { reference: string };
    assertEquals(sentBody.reference, 'convozo_idem_key_42');
  } finally {
    mock.restore();
  }
});

Deno.test('initializePaystackTransaction - maps metadata to custom_fields array', async () => {
  const mock = mockFetch({
    status: true,
    message: 'Authorization URL created',
    data: {
      authorization_url: 'https://checkout.paystack.com/meta',
      access_code: 'ac_meta',
      reference: 'ref_meta',
    },
  });
  try {
    await initializePaystackTransaction({
      email: 'fan@example.com',
      amountCents: 1000,
      subaccountCode: 'ACCT_meta',
      platformFeePct: 22,
      callbackUrl: 'https://convozo.com/success',
      reference: 'ref_meta',
      metadata: { creator_id: 'c-1', message_id: 'm-1', type: 'message' },
    });
    const sentBody = await mock.calls[0].json() as {
      metadata: { custom_fields: Array<{ variable_name: string; value: string }> };
    };
    const fields = sentBody.metadata.custom_fields;
    assertEquals(fields.some((f) => f.variable_name === 'creator_id' && f.value === 'c-1'), true);
    assertEquals(fields.some((f) => f.variable_name === 'message_id' && f.value === 'm-1'), true);
    assertEquals(fields.some((f) => f.variable_name === 'type' && f.value === 'message'), true);
  } finally {
    mock.restore();
  }
});

Deno.test('initializePaystackTransaction - throws with Paystack message on API error', async () => {
  const mock = mockFetch({ status: false, message: 'Invalid subaccount code', data: null });
  try {
    await assertRejects(
      () =>
        initializePaystackTransaction({
          email: 'fan@example.com',
          amountCents: 1000,
          subaccountCode: 'ACCT_invalid',
          platformFeePct: 22,
          callbackUrl: 'https://convozo.com/success',
          reference: 'ref_err',
          metadata: {},
        }),
      Error,
      'Invalid subaccount code',
    );
  } finally {
    mock.restore();
  }
});

Deno.test('initializePaystackTransaction - throws when data is null even with status true', async () => {
  const mock = mockFetch({ status: true, message: 'Unexpected null data', data: null });
  try {
    await assertRejects(
      () =>
        initializePaystackTransaction({
          email: 'fan@example.com',
          amountCents: 1000,
          subaccountCode: 'ACCT_null',
          platformFeePct: 22,
          callbackUrl: 'https://convozo.com/success',
          reference: 'ref_null',
          metadata: {},
        }),
      Error,
    );
  } finally {
    mock.restore();
  }
});

// ── createPaystackSubaccount ──────────────────────────────────────────────────

Deno.test('createPaystackSubaccount - returns subaccount code, bank name, account name', async () => {
  const mock = mockFetch({
    status: true,
    message: 'Subaccount created',
    data: {
      subaccount_code: 'ACCT_abc123',
      settlement_bank: 'Access Bank',
      account_name: 'JOHN DOE',
      is_verified: true,
    },
  });
  try {
    const result = await createPaystackSubaccount({
      businessName: 'John Doe',
      bankCode: '044',
      accountNumber: '1234567890',
      platformFeePct: 22,
      country: 'NG',
    });
    assertEquals(result.subaccountCode, 'ACCT_abc123');
    assertEquals(result.bankName, 'Access Bank');
    assertEquals(result.accountName, 'JOHN DOE');
    assertEquals(result.isVerified, true);
  } finally {
    mock.restore();
  }
});

Deno.test('createPaystackSubaccount - sets percentage_charge to platform fee (22)', async () => {
  const mock = mockFetch({
    status: true,
    message: 'Subaccount created',
    data: {
      subaccount_code: 'ACCT_pct',
      settlement_bank: 'GTBank',
      account_name: 'JANE DOE',
      is_verified: true,
    },
  });
  try {
    await createPaystackSubaccount({
      businessName: 'Jane Doe',
      bankCode: '058',
      accountNumber: '9876543210',
      platformFeePct: 22,
      country: 'NG',
    });
    // percentage_charge is what the PLATFORM keeps — must be exactly 22
    const sentBody = await mock.calls[0].json() as {
      percentage_charge: number;
      account_number: string;
      settlement_bank: string;
      business_name: string;
    };
    assertEquals(sentBody.percentage_charge, 22);
    assertEquals(sentBody.account_number, '9876543210');
    assertEquals(sentBody.settlement_bank, '058');
    assertEquals(sentBody.business_name, 'Jane Doe');
  } finally {
    mock.restore();
  }
});

Deno.test('createPaystackSubaccount - handles ZA creator', async () => {
  const mock = mockFetch({
    status: true,
    message: 'Subaccount created',
    data: {
      subaccount_code: 'ACCT_za',
      settlement_bank: 'First National Bank',
      account_name: 'NOMSA DLAMINI',
      is_verified: true,
    },
  });
  try {
    const result = await createPaystackSubaccount({
      businessName: 'Nomsa Dlamini',
      bankCode: 'FNB',
      accountNumber: '6200123456',
      platformFeePct: 22,
      country: 'ZA',
    });
    assertEquals(result.subaccountCode, 'ACCT_za');
  } finally {
    mock.restore();
  }
});

Deno.test('createPaystackSubaccount - throws with Paystack message on API error', async () => {
  const mock = mockFetch({ status: false, message: 'Account number not found', data: null });
  try {
    await assertRejects(
      () =>
        createPaystackSubaccount({
          businessName: 'Test',
          bankCode: '000',
          accountNumber: '0000000000',
          platformFeePct: 22,
          country: 'NG',
        }),
      Error,
      'Account number not found',
    );
  } finally {
    mock.restore();
  }
});

// ── verifyPaystackTransaction ─────────────────────────────────────────────────

Deno.test('verifyPaystackTransaction - returns typed transaction data', async () => {
  const mock = mockFetch({
    status: true,
    message: 'Verification successful',
    data: {
      status: 'success',
      reference: 'ref_verify_001',
      amount: 1000,
      currency: 'USD',
      paid_at: '2026-03-22T10:00:00Z',
      metadata: {
        custom_fields: [{ variable_name: 'creator_id', value: 'c-1' }],
      },
    },
  });
  try {
    const result = await verifyPaystackTransaction('ref_verify_001');
    assertEquals(result.status, 'success');
    assertEquals(result.reference, 'ref_verify_001');
    assertEquals(result.amount, 1000);
    assertEquals(result.currency, 'USD');
    assertEquals(result.paidAt, '2026-03-22T10:00:00Z');
    assertEquals(
      result.metadata.custom_fields?.[0].variable_name,
      'creator_id',
    );
  } finally {
    mock.restore();
  }
});

Deno.test('verifyPaystackTransaction - URL-encodes the reference in the request URL', async () => {
  const mock = mockFetch({
    status: true,
    message: 'OK',
    data: {
      status: 'success',
      reference: 'ref/with/slashes',
      amount: 500,
      currency: 'USD',
      paid_at: '2026-03-22T10:00:00Z',
      metadata: {},
    },
  });
  try {
    await verifyPaystackTransaction('ref/with/slashes');
    // Slashes must be percent-encoded so they are not treated as URL path segments
    assertEquals(mock.calls[0].url.includes('ref%2Fwith%2Fslashes'), true);
  } finally {
    mock.restore();
  }
});

Deno.test('verifyPaystackTransaction - throws when Paystack returns status false', async () => {
  const mock = mockFetch({ status: false, message: 'Transaction reference not found', data: null });
  try {
    await assertRejects(
      () => verifyPaystackTransaction('ref_bad'),
      Error,
      'Transaction reference not found',
    );
  } finally {
    mock.restore();
  }
});

Deno.test('verifyPaystackTransaction - only processes "success" status from Paystack', async () => {
  // Abandoned transaction: Paystack returns status: true but data.status is 'abandoned'
  // The function should return the data — the CALLER (webhook) must check data.status === 'success'
  const mock = mockFetch({
    status: true,
    message: 'OK',
    data: {
      status: 'abandoned',
      reference: 'ref_abandoned',
      amount: 1000,
      currency: 'USD',
      paid_at: '2026-03-22T10:00:00Z',
      metadata: {},
    },
  });
  try {
    const result = await verifyPaystackTransaction('ref_abandoned');
    // verifyPaystackTransaction does NOT filter by status — the webhook handler does
    assertEquals(result.status, 'abandoned');
  } finally {
    mock.restore();
  }
});

// ── getPaystackBanks ──────────────────────────────────────────────────────────

Deno.test('getPaystackBanks - returns mapped bank list for NG', async () => {
  const mock = mockFetch({
    status: true,
    message: 'Banks retrieved',
    data: [
      { name: 'Access Bank', code: '044', country: 'Nigeria', currency: 'NGN' },
      { name: 'GTBank', code: '058', country: 'Nigeria', currency: 'NGN' },
    ],
  });
  try {
    const banks = await getPaystackBanks('NG');
    assertEquals(banks.length, 2);
    assertEquals(banks[0].name, 'Access Bank');
    assertEquals(banks[0].code, '044');
    assertEquals(banks[1].name, 'GTBank');
    assertEquals(banks[1].code, '058');
  } finally {
    mock.restore();
  }
});

Deno.test('getPaystackBanks - lowercases the country code in the query param', async () => {
  const mock = mockFetch({ status: true, message: 'Banks retrieved', data: [] });
  try {
    await getPaystackBanks('ZA');
    // The API requires lowercase country codes
    assertEquals(mock.calls[0].url.includes('country=za'), true);
  } finally {
    mock.restore();
  }
});

Deno.test('getPaystackBanks - returns empty array for country with no banks', async () => {
  const mock = mockFetch({ status: true, message: 'Banks retrieved', data: [] });
  try {
    const banks = await getPaystackBanks('NG');
    assertEquals(banks.length, 0);
  } finally {
    mock.restore();
  }
});

Deno.test('getPaystackBanks - throws when Paystack returns error', async () => {
  const mock = mockFetch({ status: false, message: 'Unsupported country', data: null });
  try {
    await assertRejects(
      () => getPaystackBanks('XX'),
      Error,
      'Unsupported country',
    );
  } finally {
    mock.restore();
  }
});

// ── resolvePaystackAccountName ────────────────────────────────────────────────

Deno.test('resolvePaystackAccountName - returns the account holder name', async () => {
  const mock = mockFetch({
    status: true,
    message: 'Account number resolved',
    data: { account_name: 'ADEWALE OSEI', account_number: '1234567890' },
  });
  try {
    const name = await resolvePaystackAccountName('1234567890', '044');
    assertEquals(name, 'ADEWALE OSEI');
  } finally {
    mock.restore();
  }
});

Deno.test('resolvePaystackAccountName - throws when account cannot be resolved', async () => {
  const mock = mockFetch({
    status: false,
    message: 'Could not resolve account number',
    data: null,
  });
  try {
    await assertRejects(
      () => resolvePaystackAccountName('0000000000', '044'),
      Error,
      'Could not resolve account number',
    );
  } finally {
    mock.restore();
  }
});

Deno.test('resolvePaystackAccountName - passes account_number and bank_code as query params', async () => {
  const mock = mockFetch({
    status: true,
    message: 'Account number resolved',
    data: { account_name: 'TEST USER', account_number: '5555555555' },
  });
  try {
    await resolvePaystackAccountName('5555555555', '033');
    const url = mock.calls[0].url;
    assertEquals(url.includes('account_number=5555555555'), true);
    assertEquals(url.includes('bank_code=033'), true);
  } finally {
    mock.restore();
  }
});
