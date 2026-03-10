/**
 * Currency utilities — USD cents → creator's local currency
 *
 * All prices in Convozo are stored as USD cents (1000 = $10.00).
 * Before charging Flutterwave we convert to the creator's local currency
 * so that subaccount splits (which must match the transaction currency) work.
 *
 * Exchange rates are cached in-memory for 1 hour per function instance.
 */

export const COUNTRY_CURRENCY: Record<string, string> = {
  NG: 'NGN',
  GH: 'GHS',
  KE: 'KES',
  ZA: 'ZAR',
  TZ: 'TZS',
  UG: 'UGX',
  US: 'USD',
  GB: 'GBP',
  EU: 'EUR',
};

/** Minimum charge amount in each currency (Flutterwave minimums) */
const CURRENCY_MIN: Record<string, number> = {
  NGN: 100,
  GHS: 1,
  KES: 10,
  ZAR: 1,
  TZS: 100,
  UGX: 500,
  USD: 1,
  GBP: 1,
  EUR: 1,
};

/** Cached rates: { fetchedAt, rates: { NGN: 1600, GHS: 15, ... } } */
let rateCache: { fetchedAt: number; rates: Record<string, number> } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch USD → * exchange rates, with 1-hour in-memory cache.
 * Uses open.er-api.com (free, no API key required).
 */
async function fetchRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (rateCache && now - rateCache.fetchedAt < CACHE_TTL) {
    return rateCache.rates;
  }

  const res = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!res.ok) throw new Error('Failed to fetch exchange rates');

  const json = await res.json() as { result: string; rates: Record<string, number> };
  if (json.result !== 'success') throw new Error('Exchange rate API returned error');

  rateCache = { fetchedAt: now, rates: json.rates };
  return json.rates;
}

/**
 * Convert USD cents to the local currency amount for Flutterwave.
 *
 * @param usdCents   Price in USD cents (e.g. 1000 = $10.00)
 * @param country    Creator's subaccount country code (e.g. 'NG')
 * @returns          { amount, currency } ready to pass to Flutterwave
 */
export async function usdCentsToLocal(
  usdCents: number,
  country: string,
): Promise<{ amount: number; currency: string }> {
  const currency = COUNTRY_CURRENCY[country] ?? 'USD';

  // If already USD, just divide by 100
  if (currency === 'USD') {
    return { amount: usdCents / 100, currency: 'USD' };
  }

  const rates = await fetchRates();
  const rate = rates[currency];
  if (!rate) {
    // Fallback: charge USD if we don't know the rate
    return { amount: usdCents / 100, currency: 'USD' };
  }

  const localAmount = (usdCents / 100) * rate;
  // Round to nearest whole unit (most African currencies don't use decimals in practice)
  const rounded = Math.ceil(localAmount);
  // Enforce Flutterwave minimum
  const min = CURRENCY_MIN[currency] ?? 1;
  return { amount: Math.max(rounded, min), currency };
}
