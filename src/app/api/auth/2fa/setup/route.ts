/**
 * POST /api/auth/2fa/setup
 * Generate TOTP secret and QR code for 2FA setup
 * Requires valid session cookie
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, logAuthEvent } from '@/lib/auth';
import { generateTOTPSecret, generateTOTPQRCode, getManualEntryKey } from '@/lib/auth/two-factor';
import { generateRecoveryCodes, hashRecoveryCodes } from '@/lib/auth/recovery-codes';
import { run, queryOne } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Check if 2FA is already enabled
    if (user.two_factor_enabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is already enabled' },
        { status: 400 }
      );
    }

    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Generate TOTP secret
    const secret = generateTOTPSecret();

    // Generate QR code
    const qrCodeDataUrl = await generateTOTPQRCode(user.email, secret);

    // Get manual entry key
    const manualEntryKey = getManualEntryKey(secret);

    // Generate recovery codes
    const recoveryCodes = generateRecoveryCodes();
    const hashedRecoveryCodes = await hashRecoveryCodes(recoveryCodes);

    // Store the secret and hashed recovery codes (but don't enable 2FA yet)
    // User must verify with a code first
    run(
      `UPDATE users SET two_factor_secret = ?, recovery_codes = ?, updated_at = datetime('now') WHERE id = ?`,
      [secret, hashedRecoveryCodes, user.id]
    );

    // Log the setup initiation
    await logAuthEvent('2fa_enabled', user.id, ipAddress, userAgent, { action: 'setup_initiated' });

    console.log(`[2FA Setup] Setup initiated for: ${user.email}`);

    return NextResponse.json({
      success: true,
      secret,
      manualEntryKey,
      qrCode: qrCodeDataUrl,
      recoveryCodes, // Show these to user ONCE so they can save them
      message: 'Scan the QR code with your authenticator app, then verify with a code to complete setup.',
    });
  } catch (error) {
    console.error('[2FA Setup] Error:', error);
    return NextResponse.json(
      { error: 'Failed to setup 2FA' },
      { status: 500 }
    );
  }
}