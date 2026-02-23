import Stripe from 'stripe';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') || 'http://localhost:4200',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate the caller via JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { account_id } = await req.json();

    if (!account_id) {
      return new Response(
        JSON.stringify({ error: 'Missing account ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the caller owns this Stripe account
    const { data: stripeAccount, error: ownerError } = await supabase
      .from('stripe_accounts')
      .select('creator_id')
      .eq('stripe_account_id', account_id)
      .single();

    if (ownerError || !stripeAccount) {
      return new Response(
        JSON.stringify({ error: 'Stripe account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id')
      .eq('id', stripeAccount.creator_id)
      .eq('user_id', user.id)
      .single();

    if (creatorError || !creator) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: you do not own this account' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Retrieve account details from Stripe
    const account = await stripe.accounts.retrieve(account_id);

    // Update database with latest account status
    const { error } = await supabase
      .from('stripe_accounts')
      .update({
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        onboarding_completed: account.details_submitted && account.charges_enabled,
      })
      .eq('stripe_account_id', account_id);

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        onboarding_completed: account.details_submitted && account.charges_enabled,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error verifying Connect account:', err);
    return new Response(
      JSON.stringify({ error: 'An internal error occurred. Please try again later.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
