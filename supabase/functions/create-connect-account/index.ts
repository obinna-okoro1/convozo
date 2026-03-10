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
    const { creator_id, email, display_name } = await req.json();

    if (!creator_id) {
      return new Response(JSON.stringify({ error: 'creator_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const appUrl = Deno.env.get('APP_URL') || 'https://convozo.com';

    // Check if creator already has a Stripe account
    const { data: existing } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id, onboarding_completed')
      .eq('creator_id', creator_id)
      .maybeSingle();

    let stripeAccountId: string;

    if (existing?.stripe_account_id) {
      stripeAccountId = existing.stripe_account_id;
    } else {
      // Create a new Stripe Connect Express account
      const account = await stripe.accounts.create({
        type: 'express',
        email: email || undefined,
        metadata: { creator_id, display_name: display_name || '' },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      stripeAccountId = account.id;

      // Store in DB
      await supabase.from('stripe_accounts').insert({
        creator_id,
        stripe_account_id: stripeAccountId,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        onboarding_completed: false,
      });
    }

    // Create account link for onboarding (or re-onboarding)
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${appUrl}/creator/settings/payments?refresh=true`,
      return_url: `${appUrl}/creator/settings/payments?connected=true`,
      type: 'account_onboarding',
    });

    return new Response(
      JSON.stringify({
        url: accountLink.url,
        already_exists: !!existing?.stripe_account_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error creating Stripe Connect account:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to create payment account. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
