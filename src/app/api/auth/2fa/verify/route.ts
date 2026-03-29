/**
 * POST /api/auth/2fa/verify
 * Verify TOTP code and enable 2FA
 * Requires valid session cookie
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser, logAuthEvent } from '@/lib/auth';
import { verifyTOTPCode } from '@/lib/auth/two-factor';
import { run } from '@/lib/db';

const verifySchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

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

    // Check if 2FA secret exists (setup was initiated)
    if (!user.two_factor_secret) {
      return NextResponse.json(
        { error: '2FA setup not initiated. Please start setup first.' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const result = verifySchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid code format' },
        { status: 400 }
      );
    }

    const { code } = result.data;
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Verify the TOTP code
    const isValid = await verifyTOTPCode(code, user.two_factor_secret);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Enable 2FA
    run(
      `UPDATE users SET two_factor_enabled = 1, updated_at = datetime('now') WHERE id = ?`,
      [user.id]
    );

    // Log the event
    await logAuthEvent('2fa_enabled', user.id, ipAddress, userAgent, { action: 'verified' });

    console.log(`[2FA Verify] 2FA enabled for: ${user.email}`);

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication has been enabled successfully.',
    });
  } catch (error) {
    console.error('[2FA Verify] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify 2FA code' },
      { status: 500 }
    );
  }
}