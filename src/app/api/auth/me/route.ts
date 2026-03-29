/**
 * GET /api/auth/me
 * Get current user information
 * Requires valid session cookie
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Return user info (excluding sensitive data)
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.is_active === 1,
        mustChangePassword: user.must_change_password === 1,
        twoFactorEnabled: user.two_factor_enabled === 1,
        lastLoginAt: user.last_login_at,
        lastLoginIp: user.last_login_ip,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('[Auth Me] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get user info' },
      { status: 500 }
    );
  }
}