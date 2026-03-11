import Stripe from 'stripe';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey =
  Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Authenticate the caller via JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { account_id } = await req.json();

    if (!account_id) {
      return new Response(JSON.stringify({ error: 'Missing account_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up the Stripe account row by its Stripe ID
    const { data: stripeRecord, error: recordError } = await supabase
      .from('stripe_accounts')
      .select('creator_id, stripe_account_id')
      .eq('stripe_account_id', account_id)
      .maybeSingle();

    if (recordError || !stripeRecord) {
      return new Response(
        JSON.stringify({ error: 'No Stripe account found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the caller owns the creator profile linked to this Stripe account
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id')
      .eq('id', stripeRecord.creator_id)
      .eq('user_id', user.id)
      .single();

    if (creatorError || !creator) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: you do not own this account' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    return new Response(
      JSON.stringify({
        charges_enabled,
        payouts_enabled,
        details_submitted,
        onboarding_completed,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error verifying Stripe Connect account:', err);
    return new Response(
      JSON.stringify({ error: 'An internal error occurred. Please try again later.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
