import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

const FLW_SECRET_KEY = Deno.env.get('FLW_SECRET_KEY') || '';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { account_number, account_bank } = await req.json();

    if (!account_number || !account_bank) {
      return new Response(
        JSON.stringify({ error: 'account_number and account_bank are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const response = await fetch('https://api.flutterwave.com/v3/accounts/resolve', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ account_number, account_bank }),
    });

    const data = await response.json();

    if (data.status !== 'success') {
      return new Response(
        JSON.stringify({
          error: 'Could not verify this account number. Please check your bank and account number.',
          detail: data.message || 'Verification failed',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        account_name: data.data?.account_name || '',
        account_number: data.data?.account_number || account_number,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Error resolving account:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to verify account. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
