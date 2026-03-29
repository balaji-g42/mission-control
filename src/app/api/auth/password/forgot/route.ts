/**
 * POST /api/auth/password/forgot
 * Send password reset email
 * Public endpoint - no auth required
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserByEmail, setPasswordResetToken, generateResetToken, logAuthEvent } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email';

const forgotSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const result = forgotSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const { email } = result.data;
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Get user by email
    const user = await getUserByEmail(email);

    // Always return success to prevent email enumeration
    const successResponse = {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    };

    if (!user) {
      // Log the attempt but don't reveal that user doesn't exist
      console.log(`[Auth Forgot] Password reset requested for non-existent email: ${email}`);
      return NextResponse.json(successResponse);
    }

    // Check if account is active
    if (!user.is_active) {
      console.log(`[Auth Forgot] Password reset requested for disabled account: ${email}`);
      return NextResponse.json(successResponse);
    }

    // Generate reset token
    const resetToken = generateResetToken();
    await setPasswordResetToken(user.id, resetToken);

    // Build reset URL
    const baseUrl = process.env.MISSION_CONTROL_URL || 'http://localhost:4000';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    // Send reset email
    const emailSent = await sendPasswordResetEmail(email, resetToken, resetUrl);

    // Log the event
    await logAuthEvent('password_reset_requested', user.id, ipAddress, userAgent, { 
      emailSent,
      emailProvider: process.env.EMAIL_PROVIDER || 'console'
    });

    if (emailSent) {
      console.log(`[Auth Forgot] Password reset email sent to: ${email}`);
    } else {
      console.error(`[Auth Forgot] Failed to send password reset email to: ${email}`);
    }

    return NextResponse.json(successResponse);
  } catch (error) {
    console.error('[Auth Forgot] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}