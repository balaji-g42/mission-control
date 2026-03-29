/**
 * POST /api/auth/login
 * Authenticate user with email and password
 * Public endpoint - no auth required
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getUserByEmail,
  isAccountLocked,
  incrementFailedAttempts,
  lockAccount,
  resetFailedAttempts,
  updateLastLogin,
  logAuthEvent,
  createSession,
  getSessionCookieName,
  verifyPassword,
  MAX_LOGIN_ATTEMPTS,
} from '@/lib/auth';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const result = loginSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 400 }
      );
    }

    const { email, password } = result.data;
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Get user by email
    const user = await getUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists or not
      await logAuthEvent('login_failed', undefined, ipAddress, userAgent, { reason: 'user_not_found', email });
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if account is locked
    if (isAccountLocked(user)) {
      await logAuthEvent('login_failed', user.id, ipAddress, userAgent, { reason: 'account_locked' });
      return NextResponse.json(
        { error: 'Account is temporarily locked. Please try again later.' },
        { status: 423 }
      );
    }

    // Check if account is active
    if (!user.is_active) {
      await logAuthEvent('login_failed', user.id, ipAddress, userAgent, { reason: 'account_disabled' });
      return NextResponse.json(
        { error: 'Account is disabled' },
        { status: 403 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      // Increment failed attempts
      const attempts = await incrementFailedAttempts(user.id);
      
      // Lock account if too many attempts
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        await lockAccount(user.id);
        await logAuthEvent('account_locked', user.id, ipAddress, userAgent, { attempts });
        return NextResponse.json(
          { error: 'Account locked due to too many failed attempts. Please try again later.' },
          { status: 423 }
        );
      }
      
      await logAuthEvent('login_failed', user.id, ipAddress, userAgent, { reason: 'invalid_password', attempts });
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Successful login - reset failed attempts
    await resetFailedAttempts(user.id);
    await updateLastLogin(user.id, ipAddress);

    // Create session
    const session = await createSession(user.id, ipAddress, userAgent);

    // Log successful login
    await logAuthEvent('login_success', user.id, ipAddress, userAgent);

    // Set session cookie
    const cookieName = getSessionCookieName();
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: user.must_change_password === 1,
        twoFactorEnabled: user.two_factor_enabled === 1,
      },
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
    console.error('[Auth Login] Error:', error);
    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}