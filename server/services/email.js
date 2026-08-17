const env = require('../config/env');
const logger = require('./logger');

// Transactional email behind a one-function interface, with two backends.
//
// GMAIL — sends through a normal Gmail account using an App Password. No
// domain required, which is the point: Resend (and every other ESP) can only
// send from a domain you have verified by DNS, and you cannot verify
// gmail.com. Without a domain, Resend would only ever deliver to your own
// address — meaning real users still never receive a password reset, which is
// precisely the problem this feature exists to solve. Gmail's limit is ~500
// messages/day and mail arrives from the Gmail address itself.
//
// RESEND — preferred once a real domain exists: better deliverability, a
// proper from-address, and no per-account sending cap. Called over plain
// fetch rather than via its SDK, since the request is one JSON POST and
// Node 20+ ships fetch.
//
// NEITHER — the message is logged rather than sent. That keeps the reset flow
// exercisable in development and in tests without credentials, and without
// silently pretending to have sent: the log line carries the full link.
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// Resend wins when both are configured — if someone has gone to the trouble
// of verifying a domain, that is the better channel.
const provider = () => {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) return 'resend';
  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) return 'gmail';
  return null;
};

const isConfigured = () => provider() !== null;

// Gmail's from-address is fixed to the authenticated account — Gmail rewrites
// anything else — so EMAIL_FROM is only honoured as a display name wrapper.
const fromAddress = () =>
  provider() === 'gmail' ? (env.EMAIL_FROM || `NoteMind <${env.GMAIL_USER}>`) : env.EMAIL_FROM;

// Created once, lazily: nodemailer pools connections, and building a
// transport per message would open a new TLS handshake to Gmail every time.
let transporter = null;
const gmailTransport = () => {
  if (!transporter) {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
};

const deliverViaResend = async ({ to, subject, html, text }) => {
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromAddress(), to: [to], subject, html, text }),
  });

  if (!response.ok) {
    // Body is read for the log only — never surfaced to the client, since a
    // provider error can echo back the recipient address and would turn into
    // an account-existence oracle.
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend responded ${response.status}: ${detail.slice(0, 200)}`);
  }
};

const deliverViaGmail = async ({ to, subject, html, text }) => {
  await gmailTransport().sendMail({ from: fromAddress(), to, subject, html, text });
};

const sendEmail = async ({ to, subject, html, text }) => {
  const which = provider();

  if (!which) {
    logger.warn({ to, subject, text }, 'Email not configured — message logged instead of sent');
    return { delivered: false };
  }

  if (which === 'gmail') await deliverViaGmail({ to, subject, html, text });
  else await deliverViaResend({ to, subject, html, text });

  logger.info({ to, subject, provider: which }, 'Email sent');
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

// Sent by services/scheduler.js the moment a note's reminderAt comes due.
// noteUrl is a /dashboard?note=<id> deep link (see scheduler.js's noteUrl
// helper) — Dashboard.jsx reads that query param and opens NoteViewModal
// straight to this note, rather than just landing on the dashboard.
const reminderEmail = (name, noteTitle, noteUrl) => ({
  subject: `Reminder: ${noteTitle}`,
  text: [
    `Hi ${name},`,
    '',
    `Your reminder for the note "${noteTitle}" is due.`,
    '',
    noteUrl,
  ].join('\n'),
  html: `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
      <h1 style="font-size:20px;margin:0 0 16px">Reminder</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px">
        Hi ${name}, your reminder for <strong>${noteTitle}</strong> is due.
      </p>
      <p style="margin:0 0 24px">
        <a href="${noteUrl}" style="display:inline-block;background:#5b5bd6;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:15px;font-weight:600">Open note</a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#666;margin:16px 0 0">
        Turn these off any time from Account → Email notifications.
      </p>
    </div>
  `,
});

// Sent weekly by services/scheduler.js. `digest` is the same AI-generated
// summary string the in-app widget shows (aiService.generateWeeklyDigest) —
// kept identical rather than writing a second prompt, so the emailed and
// in-app versions never say different things about the same week.
const weeklyDigestEmail = (name, digest, noteCount, dashboardUrl) => ({
  subject: 'Your NoteMind weekly digest',
  text: [
    `Hi ${name},`,
    '',
    `Here's what happened across your ${noteCount} note${noteCount === 1 ? '' : 's'} from the past week:`,
    '',
    digest,
    '',
    dashboardUrl,
  ].join('\n'),
  html: `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
      <h1 style="font-size:20px;margin:0 0 16px">Your week in NoteMind</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px">Hi ${name},</p>
      <p style="font-size:15px;line-height:1.7;margin:0 0 20px;white-space:pre-wrap">${digest}</p>
      <p style="margin:0 0 24px">
        <a href="${dashboardUrl}" style="display:inline-block;background:#5b5bd6;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:15px;font-weight:600">Open NoteMind</a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#666;margin:16px 0 0">
        Turn this off any time from Account → Email notifications.
      </p>
    </div>
  `,
});

module.exports = {
  sendEmail,
  passwordResetEmail,
  reminderEmail,
  weeklyDigestEmail,
  isEmailConfigured: isConfigured,
  emailProvider: provider,
};
