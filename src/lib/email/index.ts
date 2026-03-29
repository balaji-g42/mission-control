/**
 * Email service for Mission Control
 * Supports console (dev) and SMTP (prod) providers
 */

import { createTransport, Transporter } from 'nodemailer';

// Email provider types
type EmailProvider = 'console' | 'smtp';

// Email configuration from environment
const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || 'console') as EmailProvider;
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'Mission Control <noreply@mission-control.local>';

// Singleton transporter
let transporter: Transporter | null = null;

/**
 * Get or create the email transporter
 */
function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  if (EMAIL_PROVIDER === 'smtp') {
    if (!SMTP_USER || !SMTP_PASS) {
      console.warn('[Email] SMTP provider selected but SMTP_USER/SMTP_PASS not configured. Falling back to console.');
      return null;
    }

    transporter = createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    console.log(`[Email] SMTP transporter configured: ${SMTP_HOST}:${SMTP_PORT}`);
    return transporter;
  }

  // Console provider - no transporter needed
  return null;
}

/**
 * Send an email
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<boolean> {
  try {
    const transport = getTransporter();

    if (transport) {
      // SMTP provider
      await transport.sendMail({
        from: SMTP_FROM,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      });
      console.log(`[Email] Sent to ${to}: ${subject}`);
      return true;
    } else {
      // Console provider - log to terminal
      console.log('\n╔══════════════════════════════════════════════════════════════╗');
      console.log('║  EMAIL (Console Provider)                                    ║');
      console.log('╠══════════════════════════════════════════════════════════════╣');
      console.log(`║  To: ${to.padEnd(54)} ║`);
      console.log(`║  Subject: ${subject.padEnd(49)} ║`);
      console.log('╠══════════════════════════════════════════════════════════════╣');
      // Print first 50 lines of text content
      const lines = (text || html.replace(/<[^>]*>/g, '')).split('\n').slice(0, 50);
      for (const line of lines) {
        const truncated = line.length > 58 ? line.substring(0, 55) + '...' : line;
        console.log(`║  ${truncated.padEnd(58)} ║`);
      }
      console.log('╚══════════════════════════════════════════════════════════════╝\n');
      return true;
    }
  } catch (error) {
    console.error('[Email] Failed to send email:', error);
    return false;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  resetUrl: string
): Promise<boolean> {
  const subject = 'Mission Control - Password Reset Request';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0d1117; color: #58a6ff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #161b22; padding: 30px; border: 1px solid #30363d; }
    .button { display: inline-block; background: #58a6ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .footer { background: #21262d; padding: 15px; text-align: center; font-size: 12px; color: #8b949e; border-radius: 0 0 8px 8px; }
    .warning { background: #d29922; color: #0d1117; padding: 10px; border-radius: 4px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0;">Mission Control</h1>
    <p style="margin: 5px 0 0 0;">Password Reset Request</p>
  </div>
  <div class="content">
    <p>Hello,</p>
    <p>We received a request to reset your password for your Mission Control account.</p>
    <p>Click the button below to reset your password:</p>
    <p style="text-align: center;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="background: #0d1117; padding: 10px; border-radius: 4px; word-break: break-all; color: #58a6ff;">
      ${resetUrl}
    </p>
    <div class="warning">
      <strong>⚠️ Important:</strong> This link will expire in 1 hour. If you did not request a password reset, please ignore this email.
    </div>
  </div>
  <div class="footer">
    <p>This is an automated message from Mission Control. Please do not reply to this email.</p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Mission Control - Password Reset Request

Hello,

We received a request to reset your password for your Mission Control account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email.

---
This is an automated message from Mission Control.
  `.trim();

  return sendEmail(email, subject, html, text);
}