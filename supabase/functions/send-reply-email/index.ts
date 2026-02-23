import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') || 'http://localhost:4200',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// HTML-escape to prevent XSS / injection in email templates
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate the caller via JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      .select('*, creators(display_name, user_id)')
      .eq('id', message_id)
      .single();

    if (messageError || !message) {
      return new Response(
        JSON.stringify({ error: 'Message not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the caller owns this creator profile (is the creator who received the message)
    if (message.creators.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: you do not own this message' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Send email to sender — escape user content to prevent HTML injection
    const safeDisplayName = escapeHtml(message.creators.display_name);
    const safeMessageContent = escapeHtml(message.message_content);
    const safeReplyContent = escapeHtml(reply_content);

    const emailContent = {
      to: message.sender_email,
      from: 'noreply@convozo.com',
      subject: `Reply from ${safeDisplayName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You received a reply from ${safeDisplayName}!</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Your message:</strong></p>
            <p>${safeMessageContent}</p>
          </div>
          <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Reply:</strong></p>
            <p>${safeReplyContent}</p>
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
      JSON.stringify({ error: 'An internal error occurred. Please try again later.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
