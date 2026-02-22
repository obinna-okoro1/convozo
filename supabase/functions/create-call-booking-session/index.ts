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

interface CallBookingPayload {
  creator_slug: string;
  booker_name: string;
  booker_email: string;
  booker_instagram: string;
  message_content: string;
  price: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: CallBookingPayload = await req.json();

    // Validate required fields
    if (!payload.creator_slug || !payload.booker_name || !payload.booker_email || !payload.booker_instagram || !payload.price) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get creator with settings and stripe account (same pattern as create-checkout-session)
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, display_name, creator_settings(*), stripe_accounts(stripe_account_id)')
      .eq('slug', payload.creator_slug)
      .eq('is_active', true)
      .single();

    if (creatorError || !creator) {
      return new Response(
        JSON.stringify({ error: 'Creator not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PostgREST returns one-to-one relationships as objects, not arrays
    const settings = creator.creator_settings as { calls_enabled: boolean; call_duration: number } | null;
    if (!settings || !settings.calls_enabled) {
      return new Response(
        JSON.stringify({ error: 'Call bookings are not enabled for this creator' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripeAccount = creator.stripe_accounts as { stripe_account_id: string } | null;
    if (!stripeAccount?.stripe_account_id) {
      return new Response(
        JSON.stringify({ error: 'Creator payment setup incomplete' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate platform fee (35%)
    const platformFeePercentage = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENTAGE') || '35');
    const platformFee = Math.round(payload.price * (platformFeePercentage / 100));
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:4200';

    // Check if using test Stripe account (for local development)
    const isTestAccount = stripeAccount.stripe_account_id.startsWith('acct_test_');

    // Create Stripe Checkout Session config
    const sessionConfig: Record<string, unknown> = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Video Call with ${creator.display_name}`,
              description: `${settings.call_duration} minute video call`,
            },
            unit_amount: payload.price,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'call_booking',
        creator_id: creator.id,
        creator_slug: payload.creator_slug,
        booker_name: payload.booker_name,
        booker_email: payload.booker_email,
        booker_instagram: payload.booker_instagram,
        message_content: payload.message_content || '',
        duration: settings.call_duration.toString(),
        amount: payload.price.toString(),
      },
      customer_email: payload.booker_email,
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}&type=call`,
      cancel_url: `${appUrl}/${payload.creator_slug}`,
    };

    // Only add Connect transfer if using real Stripe account
    if (!isTestAccount) {
      sessionConfig.payment_intent_data = {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: stripeAccount.stripe_account_id,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig as Stripe.Checkout.SessionCreateParams);

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error creating call booking session:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
