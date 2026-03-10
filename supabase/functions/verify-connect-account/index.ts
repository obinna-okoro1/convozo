import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey =
  Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
});

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

    const { creator_id } = await req.json();

    if (!creator_id) {
      return new Response(JSON.stringify({ error: 'Missing creator_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the caller owns this creator profile
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id')
      .eq('id', creator_id)
      .eq('user_id', user.id)
      .single();

    if (creatorError || !creator) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: you do not own this account' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the stored Stripe account
    const { data: stripeRecord, error: recordError } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('creator_id', creator_id)
      .maybeSingle();

    if (recordError || !stripeRecord) {
      return new Response(
        JSON.stringify({ error: 'No Stripe account found for this creator' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Retrieve account details from Stripe
    const account = await stripe.accounts.retrieve(stripeRecord.stripe_account_id);

    // Update database with latest status
    const { error: updateError } = await supabase
      .from('stripe_accounts')
      .update({
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        onboarding_completed:
          account.charges_enabled && account.payouts_enabled && account.details_submitted,
      })
      .eq('creator_id', creator_id);

    if (updateError) {
      console.error('Error updating stripe_accounts:', updateError);
    }

    return new Response(
      JSON.stringify({
        stripe_account_id: stripeRecord.stripe_account_id,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        onboarding_completed:
          account.charges_enabled && account.payouts_enabled && account.details_submitted,
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
