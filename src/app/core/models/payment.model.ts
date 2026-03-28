/**
 * Payment domain models
 * Stripe Connect accounts, Paystack subaccounts, and payment-related types.
 */

export type PayoutStatus = 'held' | 'pending_release' | 'released' | 'refunded';

export interface StripeAccount {
  id: string;
  creator_id: string;
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

/** A creator's registered bank account on Paystack (NG/ZA creators only). */
export interface PaystackSubaccount {
  id: string;
  creator_id: string;
  /** Paystack subaccount code, e.g. ACCT_xxxxxx */
  subaccount_code: string;
  business_name: string;
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string | null;
  country: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** A bank entry returned by the Paystack /bank list endpoint. */
export interface PaystackBank {
  name: string;
  code: string;
  country: string;
  currency: string;
}

export interface StripeConnectResponse {
  url: string;
  account_id: string;
}

export interface StripeAccountStatus {
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_completed: boolean;
}
