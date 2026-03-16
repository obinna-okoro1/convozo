import { sendEmail, messageConfirmationEmail, callBookingConfirmationEmail, newMessageNotificationEmail, newCallBookingNotificationEmail } from '../_shared/email.ts';
import { stripe, Stripe, stripeCryptoProvider } from '../_shared/stripe.ts';
import { supabase, supabaseUrl, supabaseServiceKey } from '../_shared/supabase.ts';
import { createRoom, createMeetingToken } from '../_shared/daily.ts';
import { getAppUrl } from '../_shared/http.ts';

// v3 - new webhook endpoint + secret rotation

/**
 * Fire-and-forget push notification for a creator.
 * Calls the send-push-notification Edge Function internally.
 * Errors are logged but never allowed to fail the webhook response.
 */
async function sendPushNotification(creatorId: string, title: string, body: string): Promise<void> {
  try {
    const fnUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
    const internalSecret = Deno.env.get('INTERNAL_SECRET') || '';
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Use service role key so the function can read from push_subscriptions
        'Authorization': `Bearer ${supabaseServiceKey}`,
        ...(internalSecret ? { 'x-internal-secret': internalSecret } : {}),
      },
      body: JSON.stringify({ creator_id: creatorId, title, body, url: '/creator/dashboard' }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[stripe-webhook] Push notification failed:', res.status, text);
    }
  } catch (err) {
    // Never let push failures break the webhook — payments are processed regardless
    console.error('[stripe-webhook] Push notification error (non-fatal):', (err as Error).message);
  }
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

  if (!signature) {
    return new Response(JSON.stringify({ error: 'No signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      stripeCryptoProvider,
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // Rule: never process a session that has not been fully paid.
      // checkout.session.completed fires even for sessions with payment_status='unpaid'
      // (e.g. free checkout, subscriptions awaiting invoice). Reject them immediately.
      if (session.payment_status !== 'paid') {
        console.log('Skipping session with payment_status:', session.payment_status, session.id);
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Idempotency: skip if this checkout session has already been processed
      // Check all three tables that store session IDs to cover every code path
      const [{ data: existingPayment }, { data: existingBooking }, { data: existingMessage }] = await Promise.all([
        supabase.from('payments').select('id').eq('stripe_session_id', session.id).maybeSingle(),
        supabase.from('call_bookings').select('id').eq('stripe_session_id', session.id).maybeSingle(),
        supabase.from('messages').select('id').eq('stripe_session_id', session.id).maybeSingle(),
      ]);

      if (existingPayment || existingBooking || existingMessage) {
        console.log('Checkout session already processed, skipping:', session.id);
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // ── Shop order ─────────────────────────────────────────────────────────
      if (session.metadata?.type === 'shop') {
        const { creator_id, item_id, item_title, item_type, is_request_based, buyer_name, buyer_email, request_details } =
          session.metadata as {
            creator_id: string;
            item_id: string;
            item_title: string;
            item_type: string;
            is_request_based: string;
            buyer_name: string;
            buyer_email: string;
            request_details: string;
          };

        const amountInCents = session.amount_total || 0;
        const isRequestBased = is_request_based === 'true';

        // An idempotency key derived from the Stripe session ID — stable and unique
        const idempotencyKey = `shop:${session.id}`;

        const { data: order, error: orderError } = await supabase
          .from('shop_orders')
          .insert({
            item_id,
            creator_id,
            buyer_name,
            buyer_email,
            amount_paid: amountInCents,
            stripe_session_id: session.id,
            idempotency_key: idempotencyKey,
            // Request-based items are 'pending' until the creator fulfils them;
            // digital downloads are immediately 'completed'
            status: isRequestBased ? 'pending' : 'completed',
            request_details: request_details || null,
          })
          .select('id')
          .single();

        if (orderError) {
          // UNIQUE constraint violation = duplicate webhook event — safe to ignore
          if (orderError.code === '23505') {
            console.log('[stripe-webhook] Duplicate shop order, skipping:', session.id);
            return new Response(JSON.stringify({ received: true, duplicate: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          console.error('[stripe-webhook] Error creating shop order:', orderError);
          throw orderError;
        }

        console.log('[stripe-webhook] Shop order created:', order.id, 'item:', item_id);

        // Retrieve the item file_url for immediate delivery (digital downloads)
        let fileUrl: string | null = null;
        if (!isRequestBased) {
          const { data: shopItem } = await supabase
            .from('shop_items')
            .select('file_url')
            .eq('id', item_id)
            .single();
          fileUrl = shopItem?.file_url ?? null;
        }

        // Look up creator for email notification
        const { data: shopCreator } = await supabase
          .from('creators')
          .select('display_name, email')
          .eq('id', creator_id)
          .single();

        if (shopCreator) {
          const appUrl = getAppUrl();
          const typeEmoji: Record<string, string> = {
            video: '🎬', audio: '🎵', pdf: '📄', image: '🖼️', shoutout_request: '🎥',
          };
          const emoji = typeEmoji[item_type] ?? '📦';

          // 1. Buyer confirmation email
          const buyerHtml = isRequestBased
            ? `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f0d1a;color:#fff;border-radius:1rem;overflow:hidden">
                <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:2rem;text-align:center">
                  <h1 style="margin:0;font-size:1.75rem">${emoji} Request Received!</h1>
                  <p style="margin:.5rem 0 0;opacity:.9">Order #${order.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div style="padding:2rem">
                  <p style="color:#c4b5fd;font-size:1rem">Hi <strong>${buyer_name}</strong>,</p>
                  <p style="color:#e2e8f0">Your request for <strong>${item_title}</strong> from <strong>${shopCreator.display_name}</strong> has been received! 🎉</p>
                  <div style="background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.3);border-radius:.75rem;padding:1.25rem;margin:1.5rem 0">
                    <p style="margin:0;color:#a78bfa;font-weight:600">Your brief:</p>
                    <p style="margin:.5rem 0 0;color:#e2e8f0">${request_details || 'No details provided'}</p>
                  </div>
                  <p style="color:#94a3b8">The creator will get in touch once your ${item_type.replace('_', ' ')} is ready. Keep an eye on <strong>${buyer_email}</strong>.</p>
                  <p style="color:#64748b;font-size:.875rem">Amount paid: <strong>$${(amountInCents / 100).toFixed(2)}</strong></p>
                </div>
                <div style="background:rgba(255,255,255,.05);padding:1.5rem;text-align:center">
                  <p style="margin:0;color:#64748b;font-size:.75rem">Powered by <a href="${appUrl}" style="color:#a78bfa;text-decoration:none">Convozo</a></p>
                </div>
              </div>`
            : `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f0d1a;color:#fff;border-radius:1rem;overflow:hidden">
                <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:2rem;text-align:center">
                  <h1 style="margin:0;font-size:1.75rem">${emoji} Purchase Complete!</h1>
                  <p style="margin:.5rem 0 0;opacity:.9">Your digital item is ready</p>
                </div>
                <div style="padding:2rem">
                  <p style="color:#c4b5fd;font-size:1rem">Hi <strong>${buyer_name}</strong>,</p>
                  <p style="color:#e2e8f0">Thanks for purchasing <strong>${item_title}</strong> from <strong>${shopCreator.display_name}</strong>! 🎉</p>
                  ${fileUrl ? `
                  <div style="text-align:center;margin:2rem 0">
                    <a href="${fileUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;text-decoration:none;padding:1rem 2.5rem;border-radius:.75rem;font-weight:700;font-size:1.1rem">⬇️ Download Your Item</a>
                  </div>
                  <p style="color:#94a3b8;font-size:.875rem;text-align:center">This link is your personal download. Please save your file after downloading.</p>
                  ` : `<p style="color:#94a3b8">Your download details will be sent shortly.</p>`}
                  <p style="color:#64748b;font-size:.875rem">Amount paid: <strong>$${(amountInCents / 100).toFixed(2)}</strong></p>
                </div>
                <div style="background:rgba(255,255,255,.05);padding:1.5rem;text-align:center">
                  <p style="margin:0;color:#64748b;font-size:.75rem">Powered by <a href="${appUrl}" style="color:#a78bfa;text-decoration:none">Convozo</a></p>
                </div>
              </div>`;

          const { sendEmail } = await import('../_shared/email.ts');
          await sendEmail({
            to: buyer_email,
            subject: isRequestBased
              ? `${emoji} Your request to ${shopCreator.display_name} is confirmed!`
              : `${emoji} Your purchase from ${shopCreator.display_name} is ready!`,
            html: buyerHtml,
            idempotencyKey: `${session.id}_shop_buyer`,
          });

          // 2. Creator notification email
          const creatorHtml = `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f0d1a;color:#fff;border-radius:1rem;overflow:hidden">
              <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:2rem;text-align:center">
                <h1 style="margin:0;font-size:1.75rem">🛍️ New Shop Sale!</h1>
                <p style="margin:.5rem 0 0;opacity:.9">$${(amountInCents / 100).toFixed(2)} earned</p>
              </div>
              <div style="padding:2rem">
                <p style="color:#c4b5fd">Hi <strong>${shopCreator.display_name}</strong>,</p>
                <p style="color:#e2e8f0"><strong>${buyer_name}</strong> (${buyer_email}) just purchased <strong>${item_title}</strong> from your shop.</p>
                ${isRequestBased ? `
                <div style="background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.3);border-radius:.75rem;padding:1.25rem;margin:1.5rem 0">
                  <p style="margin:0;color:#a78bfa;font-weight:600">Their brief:</p>
                  <p style="margin:.5rem 0 0;color:#e2e8f0">${request_details || 'No details provided'}</p>
                </div>
                <p style="color:#f59e0b;font-weight:600">⚡ Action required: fulfil this request and send your delivery link via your dashboard.</p>
                ` : ''}
                <a href="${appUrl}/creator/dashboard" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;text-decoration:none;padding:.875rem 2rem;border-radius:.75rem;font-weight:700;margin-top:1rem">View in Dashboard →</a>
              </div>
              <div style="background:rgba(255,255,255,.05);padding:1.5rem;text-align:center">
                <p style="margin:0;color:#64748b;font-size:.75rem">Powered by <a href="${appUrl}" style="color:#a78bfa;text-decoration:none">Convozo</a></p>
              </div>
            </div>`;

          await sendEmail({
            to: shopCreator.email,
            subject: `🛍️ New shop sale: ${item_title} — $${(amountInCents / 100).toFixed(2)}`,
            html: creatorHtml,
            idempotencyKey: `${session.id}_shop_creator`,
          });
        }

        // 3. Push notification (fire-and-forget)
        void sendPushNotification(
          creator_id,
          '🛍️ New shop sale!',
          `${buyer_name} bought "${item_title}"`,
        );

      // ── Call booking ────────────────────────────────────────────────────────
      } else if (session.metadata?.type === 'call_booking') {
        const { creator_id, booker_name, booker_email, booker_instagram, message_content, duration, scheduled_at, fan_timezone } =
          session.metadata as {
            creator_id: string;
            booker_name: string;
            booker_email: string;
            booker_instagram: string;
            message_content: string;
            duration: string;
            scheduled_at: string;
            fan_timezone: string;
          };

        const amountInCents = session.amount_total || 0;
        const durationMinutes = parseInt(duration);

        // ── Create Daily.co room for the video call ──────────────────────
        // Room is created immediately so the join link can be sent in the
        // confirmation email. Tokens are scoped + time-limited for security.
        let dailyRoomName: string | null = null;
        let dailyRoomUrl: string | null = null;
        let creatorMeetingToken: string | null = null;
        let fanMeetingToken: string | null = null;

        try {
          // Look up creator name for the meeting token display name
          const { data: creatorForRoom } = await supabase
            .from('creators')
            .select('display_name')
            .eq('id', creator_id)
            .single();

          const creatorName = creatorForRoom?.display_name || 'Creator';

          const room = await createRoom(session.id, durationMinutes);
          dailyRoomName = room.name;
          dailyRoomUrl = room.url;

          // Create scoped meeting tokens — creator is owner, fan is participant
          creatorMeetingToken = await createMeetingToken(
            room.name, creatorName, true, durationMinutes,
          );
          fanMeetingToken = await createMeetingToken(
            room.name, booker_name, false, durationMinutes,
          );
        } catch (dailyErr) {
          // Daily room creation is non-fatal — booking still created,
          // room can be created later via create-call-room function
          console.error('[stripe-webhook] Daily room creation failed (non-fatal):', (dailyErr as Error).message);
        }

        // Create call booking record with room info + escrow payout status
        const { data: booking, error: bookingError } = await supabase
          .from('call_bookings')
          .insert({
            creator_id,
            booker_name,
            booker_email,
            booker_instagram,
            duration: durationMinutes,
            amount_paid: amountInCents,
            status: 'confirmed',
            call_notes: message_content || null,
            stripe_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent as string,
            // Fan's chosen call time — set at booking, displayed in dashboard
            scheduled_at: scheduled_at || null,
            fan_timezone: fan_timezone || 'UTC',
            // Daily.co room fields
            daily_room_name: dailyRoomName,
            daily_room_url: dailyRoomUrl,
            creator_meeting_token: creatorMeetingToken,
            fan_meeting_token: fanMeetingToken,
            // Escrow: payout is held until call completion
            payout_status: 'held',
          })
          .select()
          .single();

        if (bookingError) {
          // UNIQUE constraint violation means a concurrent webhook already created this booking
          if (bookingError.code === '23505') {
            console.log('Duplicate webhook detected (booking already exists):', session.id);
            return new Response(JSON.stringify({ received: true, duplicate: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          console.error('Error creating call booking:', bookingError);
          throw bookingError;
        }

        console.log('Call booking created successfully:', booking.id);

        // Log room creation event for audit trail
        if (dailyRoomName) {
          await supabase.from('call_events').insert({
            booking_id: booking.id,
            event_type: 'room_created',
            actor: 'system',
            metadata: { room_name: dailyRoomName, room_url: dailyRoomUrl },
          });
        }

        // Send emails (fire-and-forget; failures are logged)
        const { data: callCreator } = await supabase
          .from('creators')
          .select('display_name, email')
          .eq('id', creator_id)
          .single();

        if (callCreator) {
          // Build the fan's call join URL with the secret access token.
          // The token (UUID) is auto-generated by the DB and makes the link
          // unguessable — knowing the booking ID alone is not enough.
          const appUrl = getAppUrl();
          const fanToken = booking.fan_access_token as string;
          const callJoinUrl = booking.id ? `${appUrl}/call/${booking.id}?role=fan&token=${fanToken}` : undefined;

          // 1. Confirmation to the booker (with call join link)
          const bookerEmail = callBookingConfirmationEmail({
            bookerName: booker_name,
            creatorName: callCreator.display_name,
            durationMinutes: durationMinutes,
            amountCents: amountInCents,
            callJoinUrl,
          });
          await sendEmail({ to: booker_email, ...bookerEmail, idempotencyKey: `${session.id}_call_booker` });

          // 2. Notification to the creator
          const creatorEmail = newCallBookingNotificationEmail({
            creatorName: callCreator.display_name,
            bookerName: booker_name,
            bookerEmail: booker_email,
            bookerInstagram: booker_instagram || null,
            durationMinutes: durationMinutes,
            amountCents: amountInCents,
            callNotes: message_content || null,
          });
          await sendEmail({ to: callCreator.email, ...creatorEmail, idempotencyKey: `${session.id}_call_creator` });
        }

        // 3. Push notification to the creator (fire-and-forget)
        void sendPushNotification(
          creator_id,
          '📅 New call booking!',
          `${booker_name} booked a ${durationMinutes}-minute call with you`,
        );

      } else {
        // Handle regular message payment
        const { creator_id, message_content, sender_name, sender_email, sender_instagram, message_type } =
          session.metadata as {
            creator_id: string;
            message_content: string;
            sender_name: string;
            sender_email: string;
            sender_instagram: string;
            message_type: string;
          };

        // Use Stripe-authoritative amount, not metadata (prevents manipulation)
        const amountInCents = session.amount_total || 0;
        const validMessageType = ['message', 'call', 'follow_back', 'support'].includes(message_type) ? message_type : 'message';

        // Create the message only after payment succeeds
        const { data: message, error: messageError } = await supabase
          .from('messages')
          .insert({
            creator_id,
            sender_name,
            sender_email,
            sender_instagram: sender_instagram || null,
            message_content,
            amount_paid: amountInCents,
            message_type: validMessageType,
            stripe_session_id: session.id,
          })
          .select('id')
          .single();

        if (messageError) {
          // UNIQUE constraint violation on stripe_session_id means a
          // concurrent webhook already created this message — treat as success.
          if (messageError.code === '23505') {
            console.log('Duplicate webhook detected (message already exists):', session.id);
            return new Response(JSON.stringify({ received: true, duplicate: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          console.error('Error creating message:', messageError);
          throw messageError;
        }

        // Create payment record linked to the message
        // Calculate fee using Math.round for symmetric rounding (never Math.floor)
        const platformFeePercentage = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENTAGE') || '22');
        const platformFee = Math.round(amountInCents * platformFeePercentage / 100);
        const creatorAmount = amountInCents - platformFee;

        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            message_id: message.id,
            creator_id,
            stripe_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent as string,
            amount: amountInCents,
            platform_fee: platformFee,
            creator_amount: creatorAmount,
            status: 'completed',
            sender_email,
          });

        if (paymentError) {
          console.error('Error creating payment:', paymentError);
          throw paymentError;
        }

        console.log('Message and payment created for:', message.id);

        // Send emails (fire-and-forget; failures are logged)
        const { data: msgCreator } = await supabase
          .from('creators')
          .select('display_name, email')
          .eq('id', creator_id)
          .single();

        if (msgCreator) {
          // 1. Confirmation to the sender
          const senderEmailPayload = messageConfirmationEmail({
            senderName: sender_name,
            creatorName: msgCreator.display_name,
            messageContent: message_content,
            amountCents: amountInCents,
          });
          await sendEmail({ to: sender_email, ...senderEmailPayload, idempotencyKey: `${session.id}_msg_sender` });

          // 2. Notification to the creator
          const creatorEmailPayload = newMessageNotificationEmail({
            creatorName: msgCreator.display_name,
            senderName: sender_name,
            senderEmail: sender_email,
            senderInstagram: sender_instagram || null,
            messageContent: message_content,
            amountCents: amountInCents,
          });
          await sendEmail({ to: msgCreator.email, ...creatorEmailPayload, idempotencyKey: `${session.id}_msg_creator` });
        }

        // 3. Push notification to the creator (fire-and-forget)
        void sendPushNotification(
          creator_id,
          '💬 New paid message!',
          `${sender_name} sent you a paid message`,
        );
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
