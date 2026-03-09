import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const FLW_SECRET_KEY = Deno.env.get('FLW_SECRET_KEY') || '';

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

    const { creator_id, email, display_name, bank_code, account_number, country } = await req.json();

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

    // Check if creator already has a Flutterwave subaccount
    const { data: existingAccount } = await supabase
      .from('flutterwave_subaccounts')
      .select('subaccount_id, is_active')
      .eq('creator_id', creator_id)
      .single();

    if (existingAccount?.subaccount_id && existingAccount?.is_active) {
      // Already set up — return success
      return new Response(
        JSON.stringify({
          subaccount_id: existingAccount.subaccount_id,
          already_exists: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate bank details are provided for new subaccount creation
    if (!bank_code || !account_number || !country) {
      return new Response(
        JSON.stringify({ error: 'Bank details required: bank_code, account_number, country' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the account number with Flutterwave before creating a subaccount
    const resolveResponse = await fetch('https://api.flutterwave.com/v3/accounts/resolve', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ account_number, account_bank: bank_code }),
    });

    const resolveData = await resolveResponse.json();
    let accountName = '';

    if (resolveData.status !== 'success') {
      console.error('Account verification failed:', resolveData);
      return new Response(
        JSON.stringify({
          error: resolveData.message || 'Could not verify your account number. Please double-check your bank and account number.',
          detail: resolveData.message || 'Account verification failed',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    accountName = resolveData.data?.account_name || '';

    // Step 2: Create Flutterwave subaccount
    const splitValue = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENTAGE') || '22') / 100;
    const flwPayload = {
      account_bank: bank_code,
      account_number: account_number,
      business_name: display_name || 'Creator',
      business_email: email,
      business_contact: display_name || 'Creator',
      business_contact_mobile: '0000000000', // placeholder — Flutterwave requires it
      business_mobile: '0000000000',
      country: country || 'NG',
      split_type: 'percentage',
      split_value: splitValue,
    };

    const flwResponse = await fetch('https://api.flutterwave.com/v3/subaccounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(flwPayload),
    });

    const flwData = await flwResponse.json();

    if (flwData.status !== 'success') {
      console.error('Flutterwave subaccount creation failed:', flwData);
      return new Response(
        JSON.stringify({
          error: flwData.message || 'Failed to create payment subaccount. Please try again.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subaccountId = flwData.data.subaccount_id || flwData.data.id;

    // Save or update in database
    const bankName = flwData.data.bank_name || bank_code;
    if (existingAccount) {
      await supabase
        .from('flutterwave_subaccounts')
        .update({
          subaccount_id: subaccountId,
          bank_name: bankName,
          account_number: account_number,
          country: country || 'NG',
          is_active: true,
        })
        .eq('creator_id', creator_id);
    } else {
      await supabase.from('flutterwave_subaccounts').insert({
        creator_id,
        subaccount_id: subaccountId,
        bank_name: bankName,
        account_number: account_number,
        country: country || 'NG',
        is_active: true,
      });
    }

    return new Response(
      JSON.stringify({
        subaccount_id: subaccountId,
        account_name: accountName,
        bank_name: bankName,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error creating Flutterwave subaccount:', err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: 'An internal error occurred. Please try again later.', debug: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
