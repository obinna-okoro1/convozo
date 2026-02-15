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
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { account_id } = await req.json();

    if (!account_id) {
      return new Response(
        JSON.stringify({ error: 'Missing account ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
