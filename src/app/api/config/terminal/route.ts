import { NextResponse } from 'next/server';

/**
 * Terminal Configuration API
 * Returns runtime configuration for terminal access
 */
export async function GET() {
  // Check if TTYD port is configured in environment (server-side only)
  const ttydPort = process.env.NEXT_PUBLIC_TTYD_PORT || process.env.TTYD_PORT;
  
  return NextResponse.json({
    enabled: !!ttydPort,
    port: ttydPort || null,
  });
}