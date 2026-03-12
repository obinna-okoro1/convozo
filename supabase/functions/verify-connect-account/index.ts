import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { stripe } from '../_shared/stripe.ts';
import { supabase } from '../_shared/supabase.ts';
import { jsonOk, jsonError, requireAuth } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const user = await requireAuth(req, supabase, corsHeaders);
    if (user instanceof Response) return user;

    const { account_id } = await req.json();

    if (!account_id) {
      return jsonError('Missing account_id', 400, corsHeaders);
    }

    // Look up the Stripe account row by its Stripe ID
    const { data: stripeRecord, error: recordError } = await supabase
      .from('stripe_accounts')
      .select('creator_id, stripe_account_id')
      .eq('stripe_account_id', account_id)
      .maybeSingle();

    if (recordError || !stripeRecord) {
      return jsonError('No Stripe account found', 404, corsHeaders);
    }

    // Verify the caller owns the creator profile linked to this Stripe account
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id')
      .eq('id', stripeRecord.creator_id)
      .eq('user_id', user.id)
      .single();

    if (creatorError || !creator) {
      return jsonError('Unauthorized: you do not own this account', 403, corsHeaders);
    }

    // Retrieve account details from Stripe
    const account = await stripe.accounts.retrieve(stripeRecord.stripe_account_id);

    const charges_enabled = account.charges_enabled ?? false;
    const payouts_enabled = account.payouts_enabled ?? false;
    const details_submitted = account.details_submitted ?? false;
    const onboarding_completed = charges_enabled && payouts_enabled && details_submitted;

    // Update database with latest status
    const { error: updateError } = await supabase
      .from('stripe_accounts')
      .update({
        charges_enabled,
        payouts_enabled,
        details_submitted,
        onboarding_completed,
      })
      .eq('creator_id', stripeRecord.creator_id);

    if (updateError) {
      // This is a real failure — the DB is now out of sync with Stripe.
      // Throw so the catch block returns a 500 rather than silently returning
      // stale data to the client, which could leave a creator stuck in onboarding.
      console.error('Error updating stripe_accounts:', updateError);
      throw updateError;
    }

    return jsonOk({ charges_enabled, payouts_enabled, details_submitted, onboarding_completed }, corsHeaders);
  } catch (err) {
    console.error('Error verifying Stripe Connect account:', err);
    return jsonError('An internal error occurred. Please try again later.', 500, corsHeaders);
  }
});
