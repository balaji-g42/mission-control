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

    const { email } = result.data;

    // Check if email already exists (shouldn't happen, but just in case)
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Generate random password
    const password = generateRandomPassword(16);
    
    // Hash the password
    const { hash, salt } = await hashPassword(password);

    // Create the admin user
    const user = await createUser(email, hash, salt, 'admin', true);

    // Create session for immediate login
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const session = await createSession(user.id, ipAddress, userAgent);

    // Log the registration event
    await logAuthEvent('registration', user.id, ipAddress, userAgent, { email });

    // Print password to console for the admin to save
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  ADMIN ACCOUNT CREATED                                       ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Email: ${email.padEnd(50)} ║`);
    console.log(`║  Password: ${password.padEnd(47)} ║`);
    console.log('║                                                              ║');
    console.log('║  ⚠️  SAVE THIS PASSWORD NOW!                                  ║');
    console.log('║  ⚠️  You must change it after login.                          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // Save password to secret file for later retrieval
    try {
      const fs = await import('fs');
      const path = await import('path');
      const secretsDir = path.join(process.cwd(), '.secrets');
      const secretsFile = path.join(secretsDir, 'admin-credentials.txt');
      
      // Create .secrets directory if it doesn't exist
      if (!fs.existsSync(secretsDir)) {
        fs.mkdirSync(secretsDir, { recursive: true });
      }
      
      // Write credentials to file
      const credentials = `Mission Control Admin Credentials
Created: ${new Date().toISOString()}
Email: ${email}
Password: ${password}

⚠️  IMPORTANT: 
- Change this password after first login
- Enable 2FA immediately
- Store recovery codes securely
- Delete this file after saving credentials elsewhere
`;
      fs.writeFileSync(secretsFile, credentials, 'utf8');
      console.log(`[Auth Setup] Credentials saved to: ${secretsFile}`);
    } catch (fileError) {
      console.warn('[Auth Setup] Could not save credentials to file:', fileError);
    }

    // Set session cookie
    const cookieName = getSessionCookieName();
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: true,
      },
      password, // Include password in response so UI can display it
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