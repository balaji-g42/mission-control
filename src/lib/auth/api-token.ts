/**
 * Get a valid session token for internal API calls.
 * Fetches any valid session from the database.
 * Session tokens rotate on each login and expire after 24 hours.
 */

import { queryOne } from '@/lib/db';

interface SessionToken {
  token: string;
}

/**
 * Get a valid session token from the database for internal API calls.
 * Returns the most recently created valid session token.
 */
export async function getApiToken(): Promise<string | null> {
  try {
    const session = queryOne<SessionToken>(
      `SELECT token FROM user_sessions 
       WHERE expires_at > datetime('now') 
       ORDER BY created_at DESC 
       LIMIT 1`
    );
    return session?.token || null;
  } catch (err) {
    console.error('[Auth] Failed to get API token from database:', err);
    return null;
  }
}

/**
 * Get authorization headers for internal API calls.
 * Uses session token from database instead of static env variable.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = await getApiToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}