/**
 * POST /api/auth/2fa/recovery
 * Login using a recovery code when TOTP device is unavailable
 * Public endpoint - no auth required
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserByEmail, logAuthEvent, createSession, getSessionCookieName } from '@/lib/auth';
import { verifyRecoveryCode, removeUsedRecoveryCode, countRemainingRecoveryCodes } from '@/lib/auth/recovery-codes';
import { run } from '@/lib/db';

const recoverySchema = z.object({
  email: z.string().email('Invalid email address'),
  recoveryCode: z.string().min(1, 'Recovery code is required'),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const result = recoverySchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }

    const { email, recoveryCode } = result.data;
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Get user by email
    const user = await getUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      await logAuthEvent('2fa_recovery_used', undefined, ipAddress, userAgent, { reason: 'user_not_found', email });
      return NextResponse.json(
        { error: 'Invalid recovery code' },
        { status: 400 }
      );
    }

    // Check if account is active
    if (!user.is_active) {
      await logAuthEvent('2fa_recovery_used', user.id, ipAddress, userAgent, { reason: 'account_disabled' });
      return NextResponse.json(
        { error: 'Account is disabled' },
        { status: 403 }
      );
    }

    // Check if 2FA is enabled
    if (!user.two_factor_enabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is not enabled' },
        { status: 400 }
      );
    }

    // Check if recovery codes exist
    if (!user.recovery_codes) {
      return NextResponse.json(
        { error: 'No recovery codes available' },
        { status: 400 }
      );
    }

    // Verify the recovery code
    const matchedIndex = await verifyRecoveryCode(recoveryCode, user.recovery_codes);

    if (matchedIndex === -1) {
      await logAuthEvent('2fa_recovery_used', user.id, ipAddress, userAgent, { reason: 'invalid_code' });
      return NextResponse.json(
        { error: 'Invalid recovery code' },
        { status: 400 }
      );
    }

    // Remove the used recovery code
    const updatedRecoveryCodes = removeUsedRecoveryCode(user.recovery_codes, matchedIndex);
    const remainingCount = countRemainingRecoveryCodes(updatedRecoveryCodes);

    // Update user with remaining recovery codes
    run(
      `UPDATE users SET recovery_codes = ?, failed_login_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?`,
      [updatedRecoveryCodes, user.id]
    );

    // Create session
    const session = await createSession(user.id, ipAddress, userAgent);

    // Log successful recovery
    await logAuthEvent('2fa_recovery_used', user.id, ipAddress, userAgent, { 
      remainingCodes: remainingCount,
    });

    console.log(`[2FA Recovery] Recovery code used for: ${user.email}. ${remainingCount} codes remaining.`);

    // Set session cookie
    const cookieName = getSessionCookieName();
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: user.must_change_password === 1,
        twoFactorEnabled: true,
      },
      warning: remainingCount <= 3 
        ? `Warning: Only ${remainingCount} recovery codes remaining. Generate new codes soon.`
        : undefined,
    });

    response.cookies.set(cookieName, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('[2FA Recovery] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process recovery code' },
      { status: 500 }
    );
  }
}