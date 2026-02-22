import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CallBookingPayload {
  creator_slug: string
  booker_name: string
  booker_email: string
  booker_instagram: string
  message_content: string
  price: number
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload: CallBookingPayload = await req.json()

    // Get creator by slug
    const { data: creator, error: creatorError } = await supabaseClient
      .from('creators')
      .select('id, display_name, creator_settings(*)')
      .eq('slug', payload.creator_slug)
      .single()

    if (creatorError || !creator) {
      throw new Error('Creator not found')
    }

    // PostgREST returns one-to-one relationships as objects, not arrays
    const settings = creator.creator_settings as any
    if (!settings || !settings.calls_enabled) {
      throw new Error('Call bookings are not enabled for this creator')
    }

    // Get creator's Stripe Connect account
    const { data: stripeAccount, error: stripeError } = await supabaseClient
      .from('stripe_accounts')
      .select('*')
      .eq('creator_id', creator.id)
      .single()

    if (stripeError || !stripeAccount || !stripeAccount.charges_enabled) {
      throw new Error('Creator payment account not set up')
    }

    // Calculate platform fee (35% - Option A: Stripe fees come out of platform's cut, creator gets 65% flat)
    const platformFeePercentage = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENTAGE') || '35')
    const platformFee = Math.round(payload.price * (platformFeePercentage / 100))

    // Check if using test Stripe account (for local development)
    const isTestAccount = stripeAccount.stripe_account_id.startsWith('acct_test_')

    // Create Stripe Checkout Session config
    const sessionConfig: any = {
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
        message_content: payload.message_content,
        duration: settings.call_duration,
      },
      customer_email: payload.booker_email,
      success_url: `${req.headers.get('origin') || Deno.env.get('APP_URL') || 'http://localhost:4200'}/success?session_id={CHECKOUT_SESSION_ID}&type=call`,
      cancel_url: `${req.headers.get('origin') || Deno.env.get('APP_URL') || 'http://localhost:4200'}/${payload.creator_slug}`,
    }

    // Only add Connect transfer if using real Stripe account
    if (!isTestAccount) {
      sessionConfig.payment_intent_data = {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: stripeAccount.stripe_account_id,
        },
        metadata: {
          type: 'call_booking',
          creator_id: creator.id,
          booker_name: payload.booker_name,
          booker_email: payload.booker_email,
          booker_instagram: payload.booker_instagram,
          message_content: payload.message_content,
          duration: settings.call_duration,
        },
      }
    }

    const session = await stripe.checkout.sessions.create(sessionConfig)

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error creating call booking session:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
