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

    const { subaccount_id } = await req.json();

    if (!subaccount_id) {
      return new Response(
        JSON.stringify({ error: 'Missing subaccount ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the caller owns this subaccount
    const { data: flwAccount, error: ownerError } = await supabase
      .from('flutterwave_subaccounts')
      .select('creator_id')
      .eq('subaccount_id', subaccount_id)
      .single();

    if (ownerError || !flwAccount) {
      return new Response(
        JSON.stringify({ error: 'Subaccount not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id')
      .eq('id', flwAccount.creator_id)
      .eq('user_id', user.id)
      .single();

    if (creatorError || !creator) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: you do not own this account' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch subaccount details from Flutterwave to verify it's still active
    const flwResponse = await fetch(`https://api.flutterwave.com/v3/subaccounts/${subaccount_id}`, {
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
      },
    });

    const flwData = await flwResponse.json();
    const isActive = flwData.status === 'success' && flwData.data;

    // Update database with latest status
    await supabase
      .from('flutterwave_subaccounts')
      .update({
        is_active: isActive,
      })
      .eq('subaccount_id', subaccount_id);

    return new Response(
      JSON.stringify({
        is_active: isActive,
        subaccount_id: subaccount_id,
        bank_name: flwData.data?.bank_name || null,
        account_number: flwData.data?.account_number || null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error verifying Flutterwave subaccount:', err);
    return new Response(
      JSON.stringify({ error: 'An internal error occurred. Please try again later.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
