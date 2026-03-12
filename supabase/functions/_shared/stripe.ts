/**
 * Shared Stripe client for Convozo Edge Functions.
 *
 * Instantiated once at module load with Deno-compatible fetch transport.
 * Import this instead of repeating the setup block in every function.
 *
 * Usage:
 *   import { stripe, Stripe, stripeCryptoProvider } from '../_shared/stripe.ts';
 */

import Stripe from 'stripe';

export { Stripe };

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

// SubtleCrypto provider for Deno/Edge-compatible webhook signature verification.
// Use with stripe.webhooks.constructEventAsync(body, sig, secret, cryptoProvider).
export const stripeCryptoProvider = Stripe.createSubtleCryptoProvider();
