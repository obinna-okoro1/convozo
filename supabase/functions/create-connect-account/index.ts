import Stripe from 'stripe';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { creator_id, email, display_name } = await req.json();

    if (!creator_id || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        JSON.stringify({ error: 'Unauthorized: you do not own this creator profile' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if creator already has a Stripe account
    const { data: existingAccount } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id, onboarding_completed')
      .eq('creator_id', creator_id)
      .single();

    let accountId = existingAccount?.stripe_account_id;

    // Create new Stripe Connect Express account if doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          creator_id,
          display_name: display_name || '',
        },
      });

      accountId = account.id;

      // Save to database
      await supabase.from('stripe_accounts').insert({
        creator_id,
        stripe_account_id: accountId,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        onboarding_completed: false,
      });
    }

    const appUrl = Deno.env.get('APP_URL') || 'https://convozo.com';

    // Create account link for onboarding. If the stored account ID no longer
    // exists in Stripe (e.g. stale seed data or deleted account), clear it
    // from the DB and create a fresh one.
    let accountLink;
    try {
      accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${appUrl}/creator/onboarding`,
        return_url: `${appUrl}/creator/dashboard`,
        type: 'account_onboarding',
      });
    } catch (linkErr: unknown) {
      const stripeErr = linkErr as { code?: string; raw?: { param?: string } };
      const isStaleAccount =
        stripeErr?.code === 'resource_missing' &&
        stripeErr?.raw?.param === 'account';

      if (!isStaleAccount) throw linkErr;

      // Stale account — wipe the DB row and create a fresh Stripe account
      await supabase.from('stripe_accounts').delete().eq('creator_id', creator_id);

      const freshAccount = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: { creator_id, display_name: display_name || '' },
      });

      accountId = freshAccount.id;

      await supabase.from('stripe_accounts').insert({
        creator_id,
        stripe_account_id: accountId,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        onboarding_completed: false,
      });

      accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${appUrl}/creator/onboarding`,
        return_url: `${appUrl}/creator/dashboard`,
        type: 'account_onboarding',
      });
    }

    return new Response(
      JSON.stringify({ 
        url: accountLink.url,
        account_id: accountId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error creating Connect account:', err);
    return new Response(
      JSON.stringify({ error: 'An internal error occurred. Please try again later.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
