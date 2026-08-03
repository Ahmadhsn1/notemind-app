const env = require('../config/env');
const logger = require('./logger');

// Transactional email behind a one-function interface.
//
// Resend is called over plain fetch rather than via its SDK: the request is a
// single JSON POST, and Node 20+ has fetch built in, so an SDK would be a
// dependency (and a supply-chain surface) bought for nothing. Swapping to
// SendGrid/Postmark/SES means changing only `deliver` below.
//
// With no API key configured the message is logged instead of sent. That
// keeps the whole reset flow exercisable in development and in tests without
// credentials — and, importantly, without silently pretending to send: the
// log line carries the full link so a developer can complete the flow.
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const isConfigured = () => Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);

const deliver = async ({ to, subject, html, text }) => {
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html, text }),
  });

  if (!response.ok) {
    // Body is read for the log only — never surfaced to the client, since a
    // provider error can echo back the recipient address and would turn into
    // an account-existence oracle.
    const detail = await response.text().catch(() => '');
    throw new Error(`Email provider responded ${response.status}: ${detail.slice(0, 200)}`);
  }
};

const sendEmail = async ({ to, subject, html, text }) => {
  if (!isConfigured()) {
    logger.warn({ to, subject, text }, 'Email not configured — message logged instead of sent');
    return { delivered: false };
  }

  await deliver({ to, subject, html, text });
  logger.info({ to, subject }, 'Email sent');
  return { delivered: true };
};

// Kept here rather than inline at the call site so the plain-text and HTML
// bodies can't drift apart, and so there is one place to restyle later.
const passwordResetEmail = (name, resetUrl, expiryMinutes) => ({
  subject: 'Reset your NoteMind password',
  text: [
    `Hi ${name},`,
    '',
    'Someone asked to reset the password for your NoteMind account.',
    `Open this link to choose a new one (it expires in ${expiryMinutes} minutes):`,
    '',
    resetUrl,
    '',
    "If this wasn't you, you can ignore this email — your password will not change.",
  ].join('\n'),
  html: `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
      <h1 style="font-size:20px;margin:0 0 16px">Reset your password</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px">Hi ${name},</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px">
        Someone asked to reset the password for your NoteMind account.
        This link expires in ${expiryMinutes} minutes.
      </p>
      <p style="margin:0 0 24px">
        <a href="${resetUrl}" style="display:inline-block;background:#5b5bd6;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:15px;font-weight:600">Choose a new password</a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#666;margin:0 0 8px">
        If the button doesn't work, paste this into your browser:<br>
        <span style="word-break:break-all">${resetUrl}</span>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#666;margin:16px 0 0">
        If this wasn't you, you can ignore this email — your password will not change.
      </p>
    </div>
  `,
});

module.exports = { sendEmail, passwordResetEmail, isEmailConfigured: isConfigured };
