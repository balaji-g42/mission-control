import { NextResponse } from 'next/server';

// Force dynamic rendering - this route uses environment variables
export const dynamic = 'force-dynamic';

/**
 * Terminal Configuration API
 * Returns runtime configuration for terminal access
 */
export async function GET() {
  // Check if TTYD port is configured in environment (server-side only)
  const ttydPort = process.env.TTYD_PORT;
  
  return NextResponse.json({
    enabled: !!ttydPort,
    port: ttydPort || null,
  });
}