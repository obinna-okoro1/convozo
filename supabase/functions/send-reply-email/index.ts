import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message_id, reply_content } = await req.json();

    if (!message_id || !reply_content) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get message details
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*, creators(display_name)')
      .eq('id', message_id)
      .single();

    if (messageError || !message) {
      return new Response(
        JSON.stringify({ error: 'Message not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update message with reply
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        reply_content,
        replied_at: new Date().toISOString(),
        is_handled: true,
      })
      .eq('id', message_id);

    if (updateError) {
      throw updateError;
    }

    // Send email to sender
    // TODO: Implement actual email sending service (e.g., SendGrid, Resend, etc.)
    const emailContent = {
      to: message.sender_email,
      from: 'noreply@convozo.com',
      subject: `Reply from ${message.creators.display_name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You received a reply from ${message.creators.display_name}!</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Your message:</strong></p>
            <p>${message.message_content}</p>
          </div>
          <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Reply:</strong></p>
            <p>${reply_content}</p>
          </div>
          <p style="color: #666; font-size: 14px;">
            This is an automated message from Convozo. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    console.log('Email would be sent:', emailContent);
    // Placeholder for actual email sending
    // await sendEmail(emailContent);

    return new Response(
      JSON.stringify({ success: true, message: 'Reply sent successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error sending reply:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
