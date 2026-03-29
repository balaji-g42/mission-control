/**
 * GET /api/auth/status
 * Check if any users exist in the system
 * Public endpoint - no auth required
 */

import { NextRequest, NextResponse } from 'next/server';
import { anyUsersExist, getSessionFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const usersExist = await anyUsersExist();
    const session = await getSessionFromRequest(request);
    const authenticated = !!session;

    return NextResponse.json({
      usersExist,
      setupRequired: !usersExist,
      authenticated,
    });
  } catch (error) {
    console.error('[Auth Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check auth status' },
      { status: 500 }
    );
  }
}
