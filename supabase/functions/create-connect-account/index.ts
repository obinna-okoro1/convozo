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

    // Validate email format before passing to Stripe — a Stripe API error for a
    // malformed email would expose internal messaging to the client.
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_RE.test(String(email))) {
      return jsonError('Invalid email address', 400, corsHeaders);
    }

    // Verify the caller owns this creator profile
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, slug')
      .eq('id', creator_id)
      .eq('user_id', user.id)
      .single();

    if (creatorError || !creator) {
      return jsonError('Unauthorized: you do not own this creator profile', 403, corsHeaders);
    }

    // Use the creator's slug for Stripe redirect URLs so /creator/settings is not needed.
    const creatorSlug = (creator as { id: string; slug: string }).slug;

    // Check if creator already has a Stripe account
    const { data: existingAccount } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id, onboarding_completed')
      .eq('creator_id', creator_id)
      .single();

    let accountId = existingAccount?.stripe_account_id;

    // Create new Stripe Connect Standard account if doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'standard',
        email: email,
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
        refresh_url: `${appUrl}/${creatorSlug}/settings/payments?refresh=true`,
        return_url: `${appUrl}/${creatorSlug}/settings/payments?connected=true`,
        type: 'account_onboarding',
      });
    } catch (linkErr: unknown) {
      const stripeErr = linkErr as { code?: string; type?: string; message?: string; param?: string; raw?: { param?: string; type?: string } };
      // Detect stale/invalid Stripe account IDs — covers:
      //   1. Fully deleted account → code=resource_missing, param=account
      //   2. Test-mode account used with live key → type=invalid_request_error,
      //      message contains "not connected", "does not exist", or "No such account"
      //   3. Any account-related invalid_request_error (broad fallback)
      const accountParam = stripeErr?.param === 'account' || stripeErr?.raw?.param === 'account';
      const isInvalidRequest = stripeErr?.type === 'invalid_request_error' ||
        stripeErr?.raw?.type === 'invalid_request_error' ||
        stripeErr?.type === 'StripeInvalidRequestError';
      const messageHint = typeof stripeErr?.message === 'string' &&
        /not connected|does not exist|no such account|not.+found/i.test(stripeErr.message);

      const isStaleAccount =
        (stripeErr?.code === 'resource_missing' && accountParam) ||
        (isInvalidRequest && (accountParam || messageHint));

      if (!isStaleAccount) throw linkErr;

      // Stale account — wipe the DB row and create a fresh Stripe account
      await supabase.from('stripe_accounts').delete().eq('creator_id', creator_id);

      const freshAccount = await stripe.accounts.create({
        type: 'standard',
        email: email,
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
        refresh_url: `${appUrl}/${creatorSlug}/settings/payments?refresh=true`,
        return_url: `${appUrl}/${creatorSlug}/settings/payments?connected=true`,
        type: 'account_onboarding',
      });
    }

    return jsonOk({ url: accountLink.url, account_id: accountId }, corsHeaders);
  } catch (err: unknown) {
    const errObj = err as { type?: string; code?: string; message?: string; statusCode?: number };
    console.error('[create-connect-account] FATAL:', JSON.stringify({
      type: errObj?.type,
      code: errObj?.code,
      message: errObj?.message,
      statusCode: errObj?.statusCode,
      raw: String(err),
    }));
    return jsonError('An internal error occurred. Please try again later.', 500, corsHeaders);
  }
});
