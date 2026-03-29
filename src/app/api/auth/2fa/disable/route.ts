/**
 * POST /api/auth/2fa/disable
 * Disable 2FA for the current user
 * Requires valid session cookie and current password
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser, verifyPassword, logAuthEvent } from '@/lib/auth';
import { run } from '@/lib/db';

const disableSchema = z.object({
  password: z.string().min(1, 'Password is required'),
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

    // Check if 2FA is enabled
    if (!user.two_factor_enabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is not enabled' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const result = disableSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    const { password } = result.data;
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Verify the current password
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Incorrect password' },
        { status: 400 }
      );
    }

    // Disable 2FA and clear secret/recovery codes
    run(
      `UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL, recovery_codes = NULL, updated_at = datetime('now') WHERE id = ?`,
      [user.id]
    );

    // Log the event
    await logAuthEvent('2fa_disabled', user.id, ipAddress, userAgent);

    console.log(`[2FA Disable] 2FA disabled for: ${user.email}`);

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication has been disabled.',
    });
  } catch (error) {
    console.error('[2FA Disable] Error:', error);
    return NextResponse.json(
      { error: 'Failed to disable 2FA' },
      { status: 500 }
    );
  }
}