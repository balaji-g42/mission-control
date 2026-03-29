import { NextRequest, NextResponse } from 'next/server';
import { getHealthSummary, getHealthDetail } from '@/lib/health';
import { getSessionByToken } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 *
 * Unauthenticated: returns summary {status, uptime_seconds, version}
 * Authenticated (Bearer session token) or same-origin: returns full detail payload.
 */
export async function GET(request: NextRequest) {
  try {
    const isAuthed = await isAuthenticated(request);

    if (isAuthed) {
      const detail = getHealthDetail();
      return NextResponse.json(detail);
    }

    const summary = getHealthSummary();
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: 'Health check failed', message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

/**
 * Check if the request carries a valid session token or originates from the same host.
 * Session tokens are validated against user_sessions table in the database.
 */
async function isAuthenticated(request: NextRequest): Promise<boolean> {
  // Check same-origin (browser UI hitting its own API)
  const host = request.headers.get('host');
  if (host) {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    if (origin) {
      try {
        if (new URL(origin).host === host) return true;
      } catch { /* invalid origin */ }
    }
    if (referer) {
      try {
        if (new URL(referer).host === host) return true;
      } catch { /* invalid referer */ }
    }
  }

  // Check Bearer header against session tokens
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const session = await getSessionByToken(token);
    return !!session;
  }

  return false;
}
