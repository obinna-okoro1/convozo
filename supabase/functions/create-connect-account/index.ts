import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { stripe } from '../_shared/stripe.ts';
import { supabase } from '../_shared/supabase.ts';
import { jsonOk, jsonError, requireAuth, getAppUrl } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const user = await requireAuth(req, supabase, corsHeaders);
    if (user instanceof Response) return user;

    const { creator_id, email, display_name } = await req.json();

    if (!creator_id || !email) {
      return jsonError('Missing required fields', 400, corsHeaders);
    }

    // Verify the caller owns this creator profile
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id')
      .eq('id', creator_id)
      .eq('user_id', user.id)
      .single();

    if (creatorError || !creator) {
      return jsonError('Unauthorized: you do not own this creator profile', 403, corsHeaders);
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

    // SECURITY: redirect URL is always server-controlled — never accept from client payload.
    const appUrl = getAppUrl();

    // Create account link for onboarding. If the stored account ID no longer
    // exists in Stripe (e.g. stale seed data or deleted account), clear it
    // from the DB and create a fresh one.
    let accountLink;
    try {
      accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${appUrl}/creator/settings/payments?refresh=true`,
        return_url: `${appUrl}/creator/settings/payments?connected=true`,
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
        refresh_url: `${appUrl}/creator/settings/payments?refresh=true`,
        return_url: `${appUrl}/creator/settings/payments?connected=true`,
        type: 'account_onboarding',
      });
    }

    return jsonOk({ url: accountLink.url, account_id: accountId }, corsHeaders);
  } catch (err) {
    console.error('Error creating Connect account:', err);
    return jsonError('An internal error occurred. Please try again later.', 500, corsHeaders);
  }
});
