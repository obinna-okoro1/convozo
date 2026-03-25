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

/**
 * Format an ISO date string into a human-readable call time.
 * Falls back to the raw string if the timezone is invalid.
 */
function formatCallTime(isoString: string, timezone: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
      timeZoneName: 'short',
    }).format(date);
  } catch {
    // Fallback: raw ISO string if timezone string is unrecognised
    return isoString;
  }
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
    console.error('[email] ❌ RESEND_API_KEY is not set – skipping email send');
    return false;
  }

  console.log(`[email] 📤 Attempting to send email to ${payload.to}...`);

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
      console.error(`[email] ❌ Resend ${res.status}: ${body}`);
      return false;
    }

    console.log(`[email] ✅ Email sent successfully to ${payload.to}`);
    return true;
  } catch (err) {
    console.error('[email] ❌ Network/fetch error:', err);
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
  /** Magic-link URL for the client portal — absent if generation failed */
  portalUrl?: string;
}): { subject: string; html: string } {
  const name = escapeHtml(opts.senderName);
  const creator = escapeHtml(opts.creatorName);
  const msg = escapeHtml(opts.messageContent);
  const amount = formatUsd(opts.amountCents);

  const portalBlock = opts.portalUrl
    ? `<div style="text-align:center;margin:24px 0;">
        <a href="${escapeHtml(opts.portalUrl)}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#db2777);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 32px;border-radius:12px;">
          View your Convozo portal →
        </a>
      </div>
      <p style="color:#6b7280;font-size:13px;text-align:center;">
        Track all your consultations and conversations in one place. Link expires in 24 hours.
      </p>`
    : '';

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
      ${portalBlock}
    `),
  };
}

/** Email sent to the fan after a successful call booking payment. */
export function callBookingConfirmationEmail(opts: {
  bookerName: string;
  creatorName: string;
  durationMinutes: number;
  amountCents: number;
  callJoinUrl?: string;
  /** ISO 8601 timestamp of the booked call slot */
  scheduledAt?: string;
  /** IANA timezone string the fan chose at booking (e.g. 'America/New_York') */
  fanTimezone?: string;
  /** Magic-link URL for the client portal — absent if generation failed */
  portalUrl?: string;
}): { subject: string; html: string } {
  const name = escapeHtml(opts.bookerName);
  const creator = escapeHtml(opts.creatorName);
  const amount = formatUsd(opts.amountCents);

  const scheduleBlock = opts.scheduledAt
    ? `<div style="background:#ede9fe;border-left:4px solid #7c3aed;padding:14px 16px;border-radius:6px;margin:20px 0;">
        <p style="margin:0 0 4px;font-weight:700;color:#5b21b6;">📅 Your call is scheduled for:</p>
        <p style="margin:0;color:#374151;font-size:15px;">${escapeHtml(formatCallTime(opts.scheduledAt, opts.fanTimezone || 'UTC'))}</p>
      </div>`
    : '';

  const joinBlock = opts.callJoinUrl
    ? `<div style="text-align:center;margin:24px 0;">
        <a href="${escapeHtml(opts.callJoinUrl)}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#db2777);color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 40px;border-radius:12px;">
          Join Video Call
        </a>
      </div>
      <p style="color:#6b7280;font-size:13px;line-height:1.6;">
        Use this link at the scheduled time. Both you and ${creator} need to join for the call to start.
      </p>`
    : `<p style="color:#4b5563;line-height:1.6;">
        All your booking details are in this email. We'll send you a secure join link before your call — keep an eye on your inbox!
      </p>`;

  const portalBlock = opts.portalUrl
    ? `<div style="text-align:center;margin:24px 0;">
        <a href="${escapeHtml(opts.portalUrl)}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#db2777);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 32px;border-radius:12px;">
          View your Convozo portal →
        </a>
      </div>
      <p style="color:#6b7280;font-size:13px;text-align:center;">
        Track all your consultations and bookings in one place. Link expires in 24 hours.
      </p>`
    : '';

  return {
    subject: `Booking confirmed – ${opts.durationMinutes} min call with ${creator}`,
    html: brandedWrapper(`
      <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">You're booked, ${name}!</h2>
      <p style="color:#4b5563;line-height:1.6;">
        Your <strong>${amount}</strong> booking for a <strong>${opts.durationMinutes}-minute</strong>
        video call with <strong>${creator}</strong> is confirmed.
      </p>
      ${scheduleBlock}
      ${joinBlock}
      <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0 0 4px;font-weight:600;color:#374151;">What happens next:</p>
        <ul style="margin:8px 0 0;padding-left:20px;color:#4b5563;line-height:1.8;">
          <li>When both you and ${creator} join, the call starts automatically</li>
          <li>The call lasts <strong>${opts.durationMinutes} minutes</strong></li>
          <li>Your payment is held securely until the call is completed</li>
          <li>If ${creator} doesn't show up, you'll be refunded automatically</li>
        </ul>
      </div>
      ${portalBlock}
    `),
  };
}

/** Email sent to the creator when a fan sends a paid message. */
export function newMessageNotificationEmail(opts: {
  creatorName: string;
  senderName: string;
  senderEmail: string;
  messageContent: string;
  amountCents: number;
}): { subject: string; html: string } {
  const creator = escapeHtml(opts.creatorName);
  const sender = escapeHtml(opts.senderName);
  const email = escapeHtml(opts.senderEmail);
  const msg = escapeHtml(opts.messageContent);
  const amount = formatUsd(opts.amountCents);

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
  durationMinutes: number;
  amountCents: number;
  callNotes: string | null;
  /** ISO 8601 timestamp of the booked call slot */
  scheduledAt?: string;
  /** Fan's IANA timezone string (e.g. 'America/New_York') */
  fanTimezone?: string;
  /** Creator's unique join URL for the call room */
  creatorJoinUrl?: string;
}): { subject: string; html: string } {
  const creator = escapeHtml(opts.creatorName);
  const booker = escapeHtml(opts.bookerName);
  const email = escapeHtml(opts.bookerEmail);
  const amount = formatUsd(opts.amountCents);
  const notesBlock = opts.callNotes
    ? `<div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0 0 4px;font-weight:600;color:#374151;">Call notes from booker:</p>
        <p style="margin:0;color:#4b5563;white-space:pre-wrap;">${escapeHtml(opts.callNotes)}</p>
      </div>`
    : '';
  const scheduleBlock = opts.scheduledAt
    ? `<div style="background:#ede9fe;border-left:4px solid #7c3aed;padding:14px 16px;border-radius:6px;margin:20px 0;">
        <p style="margin:0 0 4px;font-weight:700;color:#5b21b6;">📅 Scheduled for:</p>
        <p style="margin:0;color:#374151;font-size:15px;">${escapeHtml(formatCallTime(opts.scheduledAt, opts.fanTimezone || 'UTC'))}</p>
        ${opts.fanTimezone ? `<p style="margin:4px 0 0;color:#6b7280;font-size:12px;">Fan's timezone: ${escapeHtml(opts.fanTimezone)}</p>` : ''}
      </div>`
    : '';
  const joinBlock = opts.creatorJoinUrl
    ? `<div style="text-align:center;margin:24px 0;">
        <a href="${escapeHtml(opts.creatorJoinUrl)}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#db2777);color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 40px;border-radius:12px;">
          Join Video Call
        </a>
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
      ${scheduleBlock}
      <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0 0 4px;font-weight:600;color:#374151;">Booker details:</p>
        <p style="margin:4px 0;color:#4b5563;"><strong>Name:</strong> ${booker}</p>
        <p style="margin:4px 0;color:#4b5563;"><strong>Email:</strong> ${email}</p>
      </div>
      ${notesBlock}
      ${joinBlock}
      <p style="color:#4b5563;line-height:1.6;">
        You can also join from your <a href="${escapeHtml(opts.creatorJoinUrl || '')}"
          style="color:#7c3aed;font-weight:600;">Convozo dashboard</a> on the day of the call.
      </p>
    `),
  };
}

/** Email sent to the client when the expert replies. */
export function creatorReplyEmail(opts: {
  creatorName: string;
  originalMessage: string;
  replyContent: string;
  /**
   * Full URL to the client-facing conversation page, e.g.
   * `https://convozo.com/conversation/<token>`. When provided, a
   * "Continue the conversation" CTA button is rendered in the email.
   */
  conversationUrl?: string;
  /**
   * Magic-link URL for the client portal — when provided, a secondary
   * "View all your consultations" link is shown below the conversation CTA.
   */
  portalUrl?: string;
}): { subject: string; html: string } {
  const creator = escapeHtml(opts.creatorName);
  const original = escapeHtml(opts.originalMessage);
  const reply = escapeHtml(opts.replyContent);

  const portalLink = opts.portalUrl
    ? `<p style="color:#6b7280;font-size:13px;text-align:center;margin-top:12px;">
        Or <a href="${escapeHtml(opts.portalUrl)}" style="color:#7c3aed;text-decoration:underline;">view all your consultations</a> in your Convozo portal.
      </p>`
    : '';

  const ctaBlock = opts.conversationUrl
    ? `<div style="text-align:center;margin:28px 0;">
        <a href="${escapeHtml(opts.conversationUrl)}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;">
          Continue the conversation →
        </a>
      </div>
      <p style="color:#6b7280;font-size:13px;text-align:center;line-height:1.6;">
        You can reply directly from the conversation page — no account needed.
      </p>
      ${portalLink}`
    : portalLink;

  return {
    subject: `${creator} replied to your message`,
    html: brandedWrapper(`
      <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">You got a reply from ${creator}!</h2>
      <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0 0 4px;font-weight:600;color:#374151;">Your original message:</p>
        <p style="margin:0;color:#4b5563;white-space:pre-wrap;">${original}</p>
      </div>
      <div style="background:#ede9fe;border-left:4px solid #7c3aed;padding:16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0 0 4px;font-weight:600;color:#5b21b6;">Reply from ${creator}:</p>
        <p style="margin:0;color:#4b5563;white-space:pre-wrap;">${reply}</p>
      </div>
      ${ctaBlock}
    `),
  };
}

/** Email sent to the fan when the creator joins a scheduled video call. */
export function callStartNotificationEmail(opts: {
  creatorName: string;
  durationMinutes: number;
  joinUrl: string;
}): { subject: string; html: string } {
  const creator = escapeHtml(opts.creatorName);

  return {
    subject: `📞 ${creator} is ready for your call!`,
    html: brandedWrapper(`
      <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Time to connect!</h2>
      <p style="color:#4b5563;line-height:1.6;">
        <strong>${creator}</strong> is now ready for your <strong>${opts.durationMinutes}-minute</strong> video call.
        Click the button below to join.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${escapeHtml(opts.joinUrl)}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
          Join Call Now
        </a>
      </div>
      <p style="color:#9ca3af;font-size:14px;text-align:center;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <code style="background:#f3f4f6;padding:4px 8px;border-radius:4px;word-break:break-all;">${escapeHtml(opts.joinUrl)}</code>
      </p>
    `),
  };
}

/** Email sent to the creator when a fan joins the call room. */
export function fanJoinedEmail(opts: {
  creatorName: string;
  bookerName: string;
  durationMinutes: number;
  joinUrl: string;
}): { subject: string; html: string } {
  const creator = escapeHtml(opts.creatorName);
  const booker = escapeHtml(opts.bookerName);

  return {
    subject: `📞 ${booker} has joined the call — join now!`,
    html: brandedWrapper(`
      <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Your fan is waiting, ${creator}!</h2>
      <p style="color:#4b5563;line-height:1.6;">
        <strong>${booker}</strong> has joined the call room and is waiting for you.
        You have a <strong>${opts.durationMinutes}-minute</strong> session booked — click below to join now.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${escapeHtml(opts.joinUrl)}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
          Join Call Now
        </a>
      </div>
      <p style="color:#9ca3af;font-size:14px;text-align:center;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <code style="background:#f3f4f6;padding:4px 8px;border-radius:4px;word-break:break-all;">${escapeHtml(opts.joinUrl)}</code>
      </p>
    `),
  };
}
