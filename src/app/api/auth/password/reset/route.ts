/**
 * POST /api/auth/password/reset
 * Reset password using reset token
 * Public endpoint - no auth required
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserByResetToken, updateUserPassword, hashPassword, validatePassword, clearPasswordResetToken, logAuthEvent, deleteUserSessions } from '@/lib/auth';

const resetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const result = resetSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }

    const { token, password } = result.data;
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Validate password meets requirements
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return NextResponse.json(
        { error: 'Password does not meet requirements', details: passwordErrors },
        { status: 400 }
      );
    }

    // Get user by reset token
    const user = await getUserByResetToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Hash the new password
    const { hash, salt } = await hashPassword(password);

    // Update the password
    await updateUserPassword(user.id, hash, salt);

    // Clear the reset token
    await clearPasswordResetToken(user.id);

    // Invalidate all existing sessions (force re-login)
    await deleteUserSessions(user.id);

    // Log the event
    await logAuthEvent('password_reset_completed', user.id, ipAddress, userAgent);

    console.log(`[Auth Reset] Password reset completed for: ${user.email}`);

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    console.error('[Auth Reset] Error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}