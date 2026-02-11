import Stripe from 'stripe';
import { createClient } from 'supabase';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting store (in-memory, per-instance)
// In production, use Redis or similar distributed cache
const rateLimitStore = new Map<string, number[]>();

// Rate limit: 10 requests per hour per email
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const requests = rateLimitStore.get(email) || [];
  
  // Remove old requests outside the time window
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= RATE_LIMIT_MAX) {
    return false; // Rate limit exceeded
  }
  
  // Add current request
  recentRequests.push(now);
  rateLimitStore.set(email, recentRequests);
  
  return true; // Within rate limit
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { creator_slug, message_content, sender_name, sender_email, message_type, price } = 
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
          retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000 / 60), // minutes
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW / 1000)),
          } 
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

    // Get creator info
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, display_name, stripe_accounts(stripe_account_id)')
      .eq('slug', creator_slug)
      .eq('is_active', true)
      .single();

    if (creatorError || !creator) {
      return new Response(
        JSON.stringify({ error: 'Creator not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripeAccount = creator.stripe_accounts?.[0];
    if (!stripeAccount?.stripe_account_id) {
      return new Response(
        JSON.stringify({ error: 'Creator payment setup incomplete' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const platformFeePercentage = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENTAGE') || '10');
    const platformFee = Math.floor(price * (platformFeePercentage / 100));
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:4200';

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Priority Message to ${creator.display_name}`,
              description: message_type === 'business' ? 'Business Inquiry' : 'Fan Message',
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/${creator_slug}`,
      customer_email: sender_email,
      metadata: {
        creator_id: creator.id,
        message_content,
        sender_name,
        sender_email,
        message_type: message_type || 'single',
        amount: price.toString(),
      },
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: stripeAccount.stripe_account_id,
        },
      },
    });

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error creating checkout session:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
