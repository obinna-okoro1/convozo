/**
 * send-call-notification Edge Function
 *
 * Called when a creator joins a scheduled video call. Sends an email to the fan
 * with the call start time and a direct link to join the call.
 *
 * Expects:
 *   POST { booking_id: string }
 *   - Authenticated via Bearer JWT (service role or creator)
 *
 * Returns:
 *   { success: true, email_sent: boolean, message: string }
 *
 * Errors:
 *   400 — missing or invalid booking_id
 *   404 — booking not found
 *   403 — unauthorized
 */

import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { supabase } from '../_shared/supabase.ts';
import { jsonOk, jsonError, requireAuth } from '../_shared/http.ts';
import { sendEmail, callStartNotificationEmail } from '../_shared/email.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Authenticate caller (creator or service role)
    const user = await requireAuth(req, supabase, corsHeaders);
    if (user instanceof Response) return user;

    // Parse body
    const body: unknown = await req.json();
    if (
      typeof body !== 'object' || body === null ||
      !('booking_id' in body)
    ) {
      return jsonError('Missing required field: booking_id', 400, corsHeaders);
    }

    const { booking_id } = body as { booking_id: string };

    // UUID validation
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(booking_id)) {
      return jsonError('Invalid booking_id format', 400, corsHeaders);
    }

    // Fetch booking with fan & creator details
    const { data: booking, error: bookingError } = await supabase
      .from('call_bookings')
      .select(`
        id,
        booker_email,
        booker_name,
        daily_room_url,
        fan_meeting_token,
        duration,
        creators(display_name)
      `)
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      console.error('[send-call-notification] Booking not found:', bookingError);
      return jsonError('Booking not found', 404, corsHeaders);
    }

    // Build join URL
    const dailyUrl = booking.daily_room_url || '';
    const token = booking.fan_meeting_token || '';
    const joinUrl = token ? `${dailyUrl}?t=${token}` : dailyUrl;

    if (!joinUrl) {
      console.error('[send-call-notification] No room URL or token for booking:', booking_id);
      return jsonOk(
        {
          success: true,
          email_sent: false,
          message: 'Booking has no room URL or token configured',
        },
        corsHeaders
      );
    }

    // Send email to booker
    const creatorName = Array.isArray(booking.creators)
      ? booking.creators[0]?.display_name || 'Creator'
      : booking.creators?.display_name || 'Creator';

    const emailPayload = callStartNotificationEmail({
      creatorName,
      durationMinutes: booking.duration || 30,
      joinUrl,
    });

    const emailSent = await sendEmail({
      to: booking.booker_email,
      subject: emailPayload.subject,
      html: emailPayload.html,
      idempotencyKey: `call-notif-${booking_id}`,
    });

    console.log(`[send-call-notification] Email send result for ${booking.booker_email}:`, emailSent);

    if (emailSent) {
      console.log(`[send-call-notification] ✅ Email sent to ${booking.booker_email} for booking ${booking_id}`);
    } else {
      console.warn(`[send-call-notification] ⚠️ Failed to send email to ${booking.booker_email}`);
    }

    return jsonOk(
      {
        success: true,
        email_sent: emailSent,
        message: emailSent
          ? `✅ Email sent to ${booking.booker_email}`
          : '⚠️ Email send failed (check logs)',
      },
      corsHeaders
    );
  } catch (err) {
    console.error('[send-call-notification] Unexpected error:', err);
    return jsonError('Internal server error', 500, corsHeaders);
  }
});
