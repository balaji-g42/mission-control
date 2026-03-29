/**
 * POST /api/auth/setup
 * Initial admin registration - only works when no users exist
 * Public endpoint - no auth required
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  anyUsersExist, 
  createUser, 
  getUserByEmail,
  hashPassword, 
  generateRandomPassword,
  validatePassword,
  logAuthEvent,
  createSession,
  getSessionCookieName
} from '@/lib/auth';

const setupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: NextRequest) {
  try {
    // Check if users already exist
    const usersExist = await anyUsersExist();
    if (usersExist) {
      return NextResponse.json(
        { error: 'Setup already completed. Please log in.' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const result = setupSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    // Validate password
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return NextResponse.json(
        { error: passwordErrors[0] },
        { status: 400 }
      );
    }

    // Check if email already exists (shouldn't happen, but just in case)
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Hash the provided password
    const { hash, salt } = await hashPassword(password);

    // Create the admin user
    const user = await createUser(email, hash, salt, 'admin', false);

    // Create session for immediate login
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const session = await createSession(user.id, ipAddress, userAgent);

    // Log the registration event
    await logAuthEvent('registration', user.id, ipAddress, userAgent, { email });

    // Set session cookie
    const cookieName = getSessionCookieName();
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: false,
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
    console.error('[Auth Setup] Error:', error);
    return NextResponse.json(
      { error: 'Setup failed. Please try again.' },
      { status: 500 }
    );
  }
}