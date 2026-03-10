/**
 * Shared Resend email utility for Convozo Edge Functions.
 *
 * – Reads RESEND_API_KEY from the environment (set via `supabase secrets set`).
 * – Exposes a low-level `sendEmail()` and ready-made template helpers.
 * – Every piece of user-generated text is HTML-escaped before interpolation.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Escape user-supplied strings before interpolating into HTML templates. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format cents → human-readable USD string (e.g. 1500 → "$15.00"). */
function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Core mailer ──────────────────────────────────────────────────────────────

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const FROM_ADDRESS = Deno.env.get('RESEND_FROM_ADDRESS') || 'Convozo <onboarding@resend.dev>';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  /** Optional idempotency key (e.g. Stripe session_id + suffix) to prevent duplicate sends. Max 256 chars. */
  idempotencyKey?: string;
}

/**
 * Send a single transactional email via the Resend API.
 * Returns `true` on success, `false` on failure (logged, never throws).
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('[email] RESEND_API_KEY is not set – skipping email send');
    return false;
  }

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    // Resend idempotency key prevents duplicate emails on webhook retries (max 256 chars, expires 24h)
    if (payload.idempotencyKey) {
      headers['Idempotency-Key'] = payload.idempotencyKey.slice(0, 256);
    }

    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend ${res.status}:`, body);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[email] Network/fetch error:', err);
    return false;
  }
}

// ─── Branded wrapper ─────────────────────────────────────────────────────────

function brandedWrapper(innerHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Convozo</h1>
    </div>
    <!-- Body -->
    <div style="padding:32px;">
      ${innerHtml}
    </div>
    <!-- Footer -->
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">
        &copy; ${new Date().getFullYear()} Convozo &middot; This is an automated message. Please do not reply.
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

// ─── Template helpers ─────────────────────────────────────────────────────────

/** Email sent to the fan after a successful message payment. */
export function messageConfirmationEmail(opts: {
  senderName: string;
  creatorName: string;
  messageContent: string;
  amountCents: number;
}): { subject: string; html: string } {
  const name = escapeHtml(opts.senderName);
  const creator = escapeHtml(opts.creatorName);
  const msg = escapeHtml(opts.messageContent);
  const amount = formatUsd(opts.amountCents);

  return {
    subject: `Payment confirmed – message sent to ${creator}`,
    html: brandedWrapper(`
      <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Thanks, ${name}!</h2>
      <p style="color:#4b5563;line-height:1.6;">
        Your <strong>${amount}</strong> message to <strong>${creator}</strong> has been delivered.
        You'll receive an email when they reply.
      </p>
      <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0 0 4px;font-weight:600;color:#374151;">Your message:</p>
        <p style="margin:0;color:#4b5563;white-space:pre-wrap;">${msg}</p>
      </div>
    `),
  };
}

/** Email sent to the fan after a successful call booking payment. */
export function callBookingConfirmationEmail(opts: {
  bookerName: string;
  creatorName: string;
  durationMinutes: number;
  amountCents: number;
}): { subject: string; html: string } {
  const name = escapeHtml(opts.bookerName);
  const creator = escapeHtml(opts.creatorName);
  const amount = formatUsd(opts.amountCents);

  return {
    subject: `Booking confirmed – ${opts.durationMinutes} min call with ${creator}`,
    html: brandedWrapper(`
      <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">You're booked, ${name}!</h2>
      <p style="color:#4b5563;line-height:1.6;">
        Your <strong>${amount}</strong> booking for a <strong>${opts.durationMinutes}-minute</strong>
        video call with <strong>${creator}</strong> is confirmed.
      </p>
      <p style="color:#4b5563;line-height:1.6;">
        ${creator} will reach out to you to schedule the call. Keep an eye on your inbox!
      </p>
    `),
  };
}

/** Email sent to the creator when a fan sends a paid message. */
export function newMessageNotificationEmail(opts: {
  creatorName: string;
  senderName: string;
  senderEmail: string;
  senderInstagram: string | null;
  messageContent: string;
  amountCents: number;
}): { subject: string; html: string } {
  const creator = escapeHtml(opts.creatorName);
  const sender = escapeHtml(opts.senderName);
  const email = escapeHtml(opts.senderEmail);
  const msg = escapeHtml(opts.messageContent);
  const amount = formatUsd(opts.amountCents);
  const igLine = opts.senderInstagram
    ? `<p style="margin:4px 0;color:#4b5563;"><strong>Instagram:</strong> @${escapeHtml(opts.senderInstagram)}</p>`
    : '';

  return {
    subject: `💰 New ${amount} message from ${sender}`,
    html: brandedWrapper(`
      <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">New paid message, ${creator}!</h2>
      <p style="color:#4b5563;line-height:1.6;">
        <strong>${sender}</strong> just sent you a <strong>${amount}</strong> message.
      </p>
      <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0 0 4px;font-weight:600;color:#374151;">Sender details:</p>
        <p style="margin:4px 0;color:#4b5563;"><strong>Name:</strong> ${sender}</p>
        <p style="margin:4px 0;color:#4b5563;"><strong>Email:</strong> ${email}</p>
        ${igLine}
      </div>
      <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0 0 4px;font-weight:600;color:#374151;">Message:</p>
        <p style="margin:0;color:#4b5563;white-space:pre-wrap;">${msg}</p>
      </div>
      <p style="color:#4b5563;line-height:1.6;">
        Log in to <strong>Convozo</strong> to reply.
      </p>
    `),
  };
}

/** Email sent to the creator when a fan books a call. */
export function newCallBookingNotificationEmail(opts: {
  creatorName: string;
  bookerName: string;
  bookerEmail: string;
  bookerInstagram: string | null;
  durationMinutes: number;
  amountCents: number;
  callNotes: string | null;
}): { subject: string; html: string } {
  const creator = escapeHtml(opts.creatorName);
  const booker = escapeHtml(opts.bookerName);
  const email = escapeHtml(opts.bookerEmail);
  const amount = formatUsd(opts.amountCents);
  const igLine = opts.bookerInstagram
    ? `<p style="margin:4px 0;color:#4b5563;"><strong>Instagram:</strong> @${escapeHtml(opts.bookerInstagram)}</p>`
    : '';
  const notesBlock = opts.callNotes
    ? `<div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0 0 4px;font-weight:600;color:#374151;">Call notes:</p>
        <p style="margin:0;color:#4b5563;white-space:pre-wrap;">${escapeHtml(opts.callNotes)}</p>
      </div>`
    : '';

  return {
    subject: `📞 New ${opts.durationMinutes}-min call booking from ${booker}`,
    html: brandedWrapper(`
      <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">New call booking, ${creator}!</h2>
      <p style="color:#4b5563;line-height:1.6;">
        <strong>${booker}</strong> just booked a <strong>${opts.durationMinutes}-minute</strong>
        video call for <strong>${amount}</strong>.
      </p>
      <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0 0 4px;font-weight:600;color:#374151;">Booker details:</p>
        <p style="margin:4px 0;color:#4b5563;"><strong>Name:</strong> ${booker}</p>
        <p style="margin:4px 0;color:#4b5563;"><strong>Email:</strong> ${email}</p>
        ${igLine}
      </div>
      ${notesBlock}
      <p style="color:#4b5563;line-height:1.6;">
        Please reach out to <strong>${booker}</strong> at <strong>${email}</strong> to schedule the call.
      </p>
    `),
  };
}

/** Email sent to the fan when the creator replies. */
export function creatorReplyEmail(opts: {
  creatorName: string;
  originalMessage: string;
  replyContent: string;
}): { subject: string; html: string } {
  const creator = escapeHtml(opts.creatorName);
  const original = escapeHtml(opts.originalMessage);
  const reply = escapeHtml(opts.replyContent);

  return {
    subject: `${creator} replied to your message`,
    html: brandedWrapper(`
      <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">You got a reply from ${creator}!</h2>
      <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0 0 4px;font-weight:600;color:#374151;">Your message:</p>
        <p style="margin:0;color:#4b5563;white-space:pre-wrap;">${original}</p>
      </div>
      <div style="background:#ede9fe;padding:16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0 0 4px;font-weight:600;color:#374151;">Reply from ${creator}:</p>
        <p style="margin:0;color:#4b5563;white-space:pre-wrap;">${reply}</p>
      </div>
    `),
  };
}
