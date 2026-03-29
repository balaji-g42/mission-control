/**
 * POST /api/auth/logout
 * Destroy user session
 * Requires valid session cookie
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteSession, getSessionCookieName, getSessionFromRequest, logAuthEvent } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Get current session
    const session = await getSessionFromRequest(request);
    
    if (session) {
      // Log the logout event
      const ipAddress = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';
      await logAuthEvent('logout', session.user_id, ipAddress, userAgent);
      
      // Delete the session
      await deleteSession(session.token);
    }

    // Clear the session cookie
    const cookieName = getSessionCookieName();
    const response = NextResponse.json({ success: true });
    
    response.cookies.set(cookieName, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0, // Expire immediately
    });

    return response;
  } catch (error) {
    console.error('[Auth Logout] Error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}