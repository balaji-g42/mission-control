import { NextRequest, NextResponse } from 'next/server';

/**
 * Check if a request originates from the same host (browser UI).
 * Same-origin browser requests include a Referer or Origin header
 * pointing to the MC server itself. Server-side render fetches
 * (Next.js RSC) come from the same process and have no Origin.
 */
function isSameOriginRequest(request: NextRequest): boolean {
  const host = request.headers.get('host');
  if (!host) return false;

  // Server-side fetches from Next.js (no origin/referer) — same process
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // If neither origin nor referer is set, this is likely a server-side
  // fetch or a direct curl. Require auth for these (external API calls).
  if (!origin && !referer) return false;

  // Check if Origin matches the host
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host === host) return true;
    } catch {
      // Invalid origin header
    }
  }

  // Check if Referer matches the host
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host === host) return true;
    } catch {
      // Invalid referer header
    }
  }

  return false;
}

/**
 * Validate API token against user_sessions table.
 * Session tokens are stored in the database and rotate on each login.
 */
async function isValidApiToken(token: string): Promise<boolean> {
  try {
    // Dynamic import to avoid issues with Next.js middleware
    const { getSessionByToken } = await import('@/lib/auth/session');
    const session = await getSessionByToken(token);
    return !!session;
  } catch (err) {
    console.error('[Auth] Failed to validate API token:', err);
    return false;
  }
}

// Demo mode — read-only, blocks all mutations
const DEMO_MODE = process.env.DEMO_MODE === 'true';
if (DEMO_MODE) {
  console.log('[DEMO] Running in demo mode — all write operations are blocked');
}

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/setup',
  '/forgot-password',
  '/api/auth/status',
  '/api/auth/setup',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/password/forgot',
  '/api/auth/password/reset',
  '/api/auth/2fa/recovery',
  '/api/health',
];

// Check if route is public
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes without authentication
  if (isPublicRoute(pathname)) {
    // Add demo mode header for UI detection
    if (DEMO_MODE && !pathname.startsWith('/api/')) {
      const response = NextResponse.next();
      response.headers.set('X-Demo-Mode', 'true');
      return response;
    }
    return NextResponse.next();
  }

  // For API routes, check authentication
  if (pathname.startsWith('/api/')) {
    // Demo mode: block all write operations
    if (DEMO_MODE) {
      const method = request.method.toUpperCase();
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        return NextResponse.json(
          { error: 'Demo mode — this is a read-only instance. Visit github.com/crshdn/mission-control to run your own!' },
          { status: 403 }
        );
      }
      return NextResponse.next();
    }

    // Health check endpoints — bypass token auth (monitored externally)
    if (pathname === '/api/health' || pathname.startsWith('/api/health/')) {
      return NextResponse.next();
    }

    // Webhook routes use their own HMAC signature validation — bypass token auth
    if (pathname.startsWith('/api/webhooks/')) {
      return NextResponse.next();
    }

    // Auth API routes - allow without session
    if (pathname.startsWith('/api/auth/')) {
      return NextResponse.next();
    }

    // Allow same-origin browser requests (UI fetching its own API)
    if (isSameOriginRequest(request)) {
      return NextResponse.next();
    }

    // Check Authorization header for bearer token
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Validate token against user_sessions table
    // Session tokens rotate on each login and expire after 24 hours
    const valid = await isValidApiToken(token);
    if (!valid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  // For non-API routes (pages), check session cookie
  const sessionToken = request.cookies.get('mc_session')?.value;
  
  // If no session token, redirect to login
  if (!sessionToken) {
    // Check if setup is needed (no users exist)
    // We'll handle this on the client side by checking /api/auth/status
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Add demo mode header for UI detection
  if (DEMO_MODE) {
    const response = NextResponse.next();
    response.headers.set('X-Demo-Mode', 'true');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (favicon.svg, etc.)
     */
    '/((?!_next/static|_next/image|favicon|public).*)',
  ],
};