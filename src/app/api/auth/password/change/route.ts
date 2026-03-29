/**
 * POST /api/auth/password/change
 * Change password for logged-in user
 * Requires valid session cookie
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  getCurrentUser, 
  verifyPassword, 
  hashPassword, 
  validatePassword, 
  updateUserPassword,
  logAuthEvent,
  setMustChangePassword
} from '@/lib/auth';

const changeSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(1, 'New password is required'),
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

    // Parse and validate request body
    const body = await request.json();
    const result = changeSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = result.data;
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Verify current password (skip if must change password)
    if (!user.must_change_password && currentPassword) {
      const isValidPassword = await verifyPassword(currentPassword, user.password_hash);
      if (!isValidPassword) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        );
      }
    }

    // Validate new password meets requirements
    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      return NextResponse.json(
        { error: 'New password does not meet requirements', details: passwordErrors },
        { status: 400 }
      );
    }

    // Check if new password is the same as current (skip if must change password)
    if (!user.must_change_password) {
      const isSamePassword = await verifyPassword(newPassword, user.password_hash);
      if (isSamePassword) {
        return NextResponse.json(
          { error: 'New password must be different from current password' },
          { status: 400 }
        );
      }
    }

    // Hash the new password
    const { hash, salt } = await hashPassword(newPassword);

    // Update the password
    await updateUserPassword(user.id, hash, salt);

    // Clear must_change_password flag if it was set
    if (user.must_change_password) {
      await setMustChangePassword(user.id, false);
    }

    // Log the event
    await logAuthEvent('password_changed', user.id, ipAddress, userAgent);

    console.log(`[Auth Change] Password changed for: ${user.email}`);

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('[Auth Change] Error:', error);
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    );
  }
}