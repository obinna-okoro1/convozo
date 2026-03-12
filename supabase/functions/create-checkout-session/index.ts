import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { stripe } from '../_shared/stripe.ts';
import { supabase } from '../_shared/supabase.ts';
import { jsonOk, jsonError, makeRateLimiter } from '../_shared/http.ts';

// Rate limit: 10 checkout requests per hour per sender email
const checkRateLimit = makeRateLimiter(10, 60 * 60 * 1000);

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { creator_slug, message_content, sender_name, sender_email, sender_instagram, message_type, price } =
      await req.json();

    // Validate input
    if (!creator_slug || !message_content || !sender_name || !sender_email || !price) {
      return jsonError('Missing required fields', 400, corsHeaders);
    }

    // Check rate limit
    if (!checkRateLimit(sender_email)) {
      return jsonError('Rate limit exceeded. Please try again later.', 429, {
        ...corsHeaders,
        'Retry-After': '3600',
      });
    }

    // Validate message content length
    if (message_content.length > 1000) {
      return jsonError('Message too long (max 1000 characters)', 400, corsHeaders);
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sender_email)) {
      return jsonError('Invalid email address', 400, corsHeaders);
    }

    // Get creator info
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, display_name, stripe_accounts(stripe_account_id), creator_settings(message_price, follow_back_price, follow_back_enabled, tips_enabled)')
      .eq('slug', creator_slug)
      .eq('is_active', true)
      .single();

    if (creatorError || !creator) {
      return jsonError('Creator not found', 404, corsHeaders);
    }

    // Get the server-authoritative price from creator_settings (NEVER trust client-sent price)
    const settings = creator.creator_settings as { message_price: number; follow_back_price: number | null; follow_back_enabled: boolean; tips_enabled: boolean } | null;
    if (!settings?.message_price || settings.message_price < 100) {
      return jsonError('Creator pricing not configured', 400, corsHeaders);
    }

    // Normalise message_type to match DB constraint ('message' | 'call' | 'follow_back' | 'support')
    const validTypes = ['message', 'call', 'follow_back', 'support'];
    const validMessageType = validTypes.includes(message_type) ? message_type : 'message';

    // Determine the correct price based on type
    let serverPrice = settings.message_price;
    let productName = `Paid DM to ${creator.display_name}`;
    let productDescription = 'Priority direct message';

    if (validMessageType === 'follow_back') {
      if (!settings.follow_back_enabled || !settings.follow_back_price || settings.follow_back_price < 100) {
        return jsonError('Follow-back requests are not enabled for this creator', 400, corsHeaders);
      }
      serverPrice = settings.follow_back_price;
      productName = `Follow-Back Request to ${creator.display_name}`;
      productDescription = 'Request a follow-back on Instagram';
    }

    if (validMessageType === 'support') {
      if (!settings.tips_enabled) {
        return jsonError('Fan support is not enabled for this creator', 400, corsHeaders);
      }
      // For tips, use the client-sent price (fan chooses the amount) with a $1 minimum
      const tipAmount = typeof price === 'number' ? price : 0;
      if (tipAmount < 100) {
        return jsonError('Minimum support amount is $1.00', 400, corsHeaders);
      }
      serverPrice = tipAmount;
      productName = `Support for ${creator.display_name}`;
      productDescription = 'Fan support / tip';
    }

    // PostgREST returns one-to-one relationships as objects, not arrays
    const stripeAccount = creator.stripe_accounts as { stripe_account_id: string } | null;
    if (!stripeAccount?.stripe_account_id) {
      return jsonError('Creator payment setup incomplete', 400, corsHeaders);
    }

    const platformFeePercentage = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENTAGE') || '22');
    // Math.round for symmetric rounding — never Math.floor (undercounts) or Math.ceil (overcounts creator)
    const platformFee = Math.round(serverPrice * platformFeePercentage / 100);
    const appUrl = Deno.env.get('APP_URL') || 'https://convozo.com';

    // Create Stripe Checkout session
    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: serverPrice,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}&creator=${creator_slug}`,
      cancel_url: `${appUrl}/${creator_slug}`,
      customer_email: sender_email,
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: stripeAccount.stripe_account_id,
        },
      },
      metadata: {
        creator_id: creator.id,
        message_content: message_content.slice(0, 490),
        sender_name: sender_name.slice(0, 490),
        sender_email,
        sender_instagram: (sender_instagram || '').slice(0, 490),
        message_type: validMessageType,
        amount: serverPrice.toString(),
      },
    };

    // Idempotency key prevents duplicate sessions on network retries within a 10-minute window.
    // Must include serverPrice so that a different amount (e.g. a different tip value) always
    // generates a new session — Stripe rejects a key reused with different parameters.
    // The time window means the key expires naturally, allowing new sessions after 10 minutes.
    const windowSlot = Math.floor(Date.now() / (10 * 60 * 1000)); // 10-minute slots
    const idempotencyRaw = `${sender_email}:${creator_slug}:${validMessageType}:${serverPrice}:${message_content.slice(0, 50)}:${windowSlot}`;
    const idempotencyKey = btoa(idempotencyRaw).slice(0, 64);

    const session = await stripe.checkout.sessions.create(sessionConfig, {
      idempotencyKey,
    });

    return jsonOk({ sessionId: session.id, url: session.url }, corsHeaders);
  } catch (err) {
    console.error('Error creating checkout session:', err);
    return jsonError('An internal error occurred. Please try again later.', 500, corsHeaders);
  }
});
