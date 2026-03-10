import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { usdCentsToLocal } from '../_shared/currency.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const FLW_SECRET_KEY = Deno.env.get('FLW_SECRET_KEY') || '';

// Rate limiting store (in-memory, per-instance)
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const requests = (rateLimitStore.get(key) || []).filter(t => now - t < RATE_LIMIT_WINDOW);
  if (requests.length >= RATE_LIMIT_MAX) return false;
  requests.push(now);
  rateLimitStore.set(key, requests);
  return true;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CallBookingPayload {
  creator_slug: string;
  booker_name: string;
  booker_email: string;
  booker_instagram: string;
  message_content: string;
  price: number;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const payload: CallBookingPayload = await req.json();

    // Validate required fields
    if (!payload.creator_slug || !payload.booker_name || !payload.booker_email || !payload.booker_instagram) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    if (!EMAIL_RE.test(payload.booker_email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate message content length
    if (payload.message_content && payload.message_content.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Message too long (max 2000 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit: 10 requests per hour per email
    if (!checkRateLimit(payload.booker_email)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
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

    // Get creator with settings and Flutterwave subaccount
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, display_name, creator_settings(*), flutterwave_subaccounts(subaccount_id, country)')
      .eq('slug', payload.creator_slug)
      .eq('is_active', true)
      .single();

    if (creatorError || !creator) {
      return new Response(
        JSON.stringify({ error: 'Creator not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const settings = creator.creator_settings as { calls_enabled: boolean; call_duration: number; call_price: number } | null;
    if (!settings || !settings.calls_enabled) {
      return new Response(
        JSON.stringify({ error: 'Call bookings are not enabled for this creator' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the server-authoritative price (NEVER trust client-sent price)
    const serverPrice = settings.call_price;
    if (!serverPrice || serverPrice < 100) {
      return new Response(
        JSON.stringify({ error: 'Creator call pricing not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const flwSubaccount = creator.flutterwave_subaccounts as { subaccount_id: string; country: string } | null;
    if (!flwSubaccount?.subaccount_id) {
      return new Response(
        JSON.stringify({ error: 'Creator payment setup incomplete' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const platformFeePercentage = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENTAGE') || '22');
    const appUrl = Deno.env.get('APP_URL') || 'https://convozo.com';

    // serverPrice is in USD cents — convert to creator's local currency so Flutterwave
    // subaccount split (which must match the transaction currency) works correctly.
    const { amount, currency } = await usdCentsToLocal(serverPrice, flwSubaccount.country || 'NG');

    // Generate a unique transaction reference
    const txRef = `convozo_call_${crypto.randomUUID()}`;

    // Build Flutterwave Standard payment request
    const flwPayload = {
      tx_ref: txRef,
      amount,
      currency,
      redirect_url: `${appUrl}/success?tx_ref=${txRef}&type=call`,
      customer: {
        email: payload.booker_email,
        name: payload.booker_name,
      },
      customizations: {
        title: 'Convozo',
        description: `Video Call with ${creator.display_name} (${settings.call_duration} min)`,
        logo: `${appUrl}/assets/icons/icon-192x192.png`,
      },
      subaccounts: [
        {
          id: flwSubaccount.subaccount_id,
          // transaction_charge is the SUBACCOUNT's (creator's) percentage in 0-1 range.
          // e.g. platformFeePercentage=22 → creator keeps 78% → 0.78
          transaction_charge_type: 'percentage',
          transaction_charge: (100 - platformFeePercentage) / 100,
        },
      ],
      meta: {
        type: 'call_booking',
        creator_id: creator.id,
        creator_slug: payload.creator_slug,
        booker_name: payload.booker_name,
        booker_email: payload.booker_email,
        booker_instagram: payload.booker_instagram,
        message_content: payload.message_content || '',
        duration: settings.call_duration.toString(),
        // USD cents — used by the webhook for amount_paid storage (not the local currency amount)
        amount_cents: serverPrice.toString(),
      },
    };

    const flwResponse = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(flwPayload),
    });

    const flwData = await flwResponse.json();

    if (flwData.status !== 'success') {
      console.error('Flutterwave payment init failed:', flwData);
      throw new Error(flwData.message || 'Failed to initialize payment');
    }

    return new Response(
      JSON.stringify({ url: flwData.data.link, tx_ref: txRef }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error creating call booking session:', err);
    return new Response(
      JSON.stringify({ error: 'An internal error occurred. Please try again later.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
