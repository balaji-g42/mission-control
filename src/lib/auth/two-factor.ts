/**
 * Two-Factor Authentication (2FA) utilities
 * Uses TOTP (Time-based One-Time Password) via otplib v13
 */

import { generateSecret, generate, verify, generateURI } from 'otplib';
import QRCode from 'qrcode';

// TOTP configuration
const TOTP_ISSUER = 'Mission Control';

/**
 * Generate a new TOTP secret for a user
 */
export function generateTOTPSecret(): string {
  return generateSecret();
}

/**
 * Generate a QR code URL for TOTP setup
 */
export async function generateTOTPQRCode(email: string, secret: string): Promise<string> {
  const otpauthUrl = generateURI({
    issuer: TOTP_ISSUER,
    label: email,
    secret,
  });
  
  // Generate QR code as data URL
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
  
  return qrCodeDataUrl;
}

/**
 * Verify a TOTP code against a secret
 * Returns true if valid, false otherwise
 */
export async function verifyTOTPCode(code: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token: code });
    return result.valid;
  } catch (error) {
    console.error('[2FA] TOTP verification error:', error);
    return false;
  }
}

/**
 * Generate a TOTP code (for testing purposes)
 */
export async function generateTOTPCode(secret: string): Promise<string> {
  return generate({ secret });
}

/**
 * Get the manual entry key for TOTP setup
 * This is the secret in a user-friendly format
 */
export function getManualEntryKey(secret: string): string {
  // Format secret in groups of 4 characters for easier manual entry
  return secret.match(/.{1,4}/g)?.join(' ') || secret;
}