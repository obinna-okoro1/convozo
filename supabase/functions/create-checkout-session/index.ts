import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2024-06-20' });

// Rate limiting store (in-memory, per-instance)
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const requests = rateLimitStore.get(email) || [];
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
  if (recentRequests.length >= RATE_LIMIT_MAX) return false;
  recentRequests.push(now);
  rateLimitStore.set(email, recentRequests);
  return true;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { creator_slug, message_content, sender_name, sender_email, sender_instagram, message_type, price } =
      await req.json();

    // Validate input
    if (!creator_slug || !message_content || !sender_name || !sender_email || !price) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    if (!checkRateLimit(sender_email)) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000 / 60),
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW / 1000)),
          },
        }
      );
    }

    // Validate message content length
    if (message_content.length > 1000) {
      return new Response(
        JSON.stringify({ error: 'Message too long (max 1000 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sender_email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get creator info + Stripe account for split payments
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, display_name, stripe_accounts(stripe_account_id, charges_enabled), creator_settings(message_price, follow_back_price, follow_back_enabled, tips_enabled)')
      .eq('slug', creator_slug)
      .eq('is_active', true)
      .single();

    if (creatorError || !creator) {
      return new Response(
        JSON.stringify({ error: 'Creator not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the server-authoritative price from creator_settings (NEVER trust client-sent price)
    const settings = creator.creator_settings as { message_price: number; follow_back_price: number | null; follow_back_enabled: boolean; tips_enabled: boolean } | null;
    if (!settings?.message_price || settings.message_price < 100) {
      return new Response(
        JSON.stringify({ error: 'Creator pricing not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalise message_type to match DB constraint
    const validTypes = ['message', 'call', 'follow_back', 'support'];
    const validMessageType = validTypes.includes(message_type) ? message_type : 'message';

    // Determine the correct price based on type
    let serverPrice = settings.message_price;
    let productName = `Paid DM to ${creator.display_name}`;

    if (validMessageType === 'follow_back') {
      if (!settings.follow_back_enabled || !settings.follow_back_price || settings.follow_back_price < 100) {
        return new Response(
          JSON.stringify({ error: 'Follow-back requests are not enabled for this creator' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      serverPrice = settings.follow_back_price;
      productName = `Follow-Back Request to ${creator.display_name}`;
    }

    if (validMessageType === 'support') {
      if (!settings.tips_enabled) {
        return new Response(
          JSON.stringify({ error: 'Fan support is not enabled for this creator' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const tipAmount = typeof price === 'number' ? price : 0;
      if (tipAmount < 100) {
        return new Response(
          JSON.stringify({ error: 'Minimum support amount is $1.00' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      serverPrice = tipAmount;
      productName = `Support for ${creator.display_name}`;
    }

    // Check Stripe account
    const stripeAccount = creator.stripe_accounts as { stripe_account_id: string; charges_enabled: boolean } | null;
    if (!stripeAccount?.stripe_account_id || !stripeAccount.charges_enabled) {
      return new Response(
        JSON.stringify({ error: 'Creator payment setup incomplete' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const platformFeePercentage = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENTAGE') || '22');
    const applicationFeeAmount = Math.floor(serverPrice * platformFeePercentage / 100);
    const appUrl = Deno.env.get('APP_URL') || 'https://convozo.com';

    // Create Stripe Checkout Session with Connect split
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: productName },
          unit_amount: serverPrice,
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: sender_email,
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        transfer_data: { destination: stripeAccount.stripe_account_id },
      },
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}&type=message`,
      cancel_url: `${appUrl}/${creator_slug}`,
      metadata: {
        creator_id: creator.id,
        message_content: message_content.slice(0, 490),
        sender_name: sender_name.slice(0, 490),
        sender_email,
        sender_instagram: (sender_instagram || '').slice(0, 490),
        message_type: validMessageType,
        amount_cents: serverPrice.toString(),
      },
    });

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error creating checkout session:', err);
    return new Response(
      JSON.stringify({ error: 'An internal error occurred. Please try again later.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
  }
});
