/**
 * Session management for user authentication
 * Server-side sessions stored in SQLite for security
 */

import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, queryAll, run } from '@/lib/db';

// Session configuration
const SESSION_TOKEN_LENGTH = 32; // 64 hex characters
const DEFAULT_SESSION_EXPIRY_HOURS = 24;

export interface UserSession {
  id: string;
  user_id: string;
  token: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: string;
  created_at: string;
}

/**
 * Generate a secure random session token
 */
export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_LENGTH).toString('hex');
}

/**
 * Create a new session for a user
 */
export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string,
  expiryHours: number = DEFAULT_SESSION_EXPIRY_HOURS
): Promise<UserSession> {
  const id = uuidv4();
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

  run(
    `INSERT INTO user_sessions (id, user_id, token, ip_address, user_agent, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [id, userId, token, ipAddress || null, userAgent || null, expiresAt]
  );

  return {
    id,
    user_id: userId,
    token,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  };
}

/**
 * Get a session by token
 */
export async function getSessionByToken(token: string): Promise<UserSession | null> {
  const session = queryOne<UserSession>(
    `SELECT * FROM user_sessions WHERE token = ? AND expires_at > datetime('now')`,
    [token]
  );
  return session ?? null;
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<UserSession[]> {
  return queryAll<UserSession>(
    `SELECT * FROM user_sessions WHERE user_id = ? AND expires_at > datetime('now') ORDER BY created_at DESC`,
    [userId]
  );
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(token: string): Promise<boolean> {
  const result = run(`DELETE FROM user_sessions WHERE token = ?`, [token]);
  return result.changes > 0;
}

/**
 * Delete all sessions for a user (force logout everywhere)
 */
export async function deleteUserSessions(userId: string): Promise<number> {
  const result = run(`DELETE FROM user_sessions WHERE user_id = ?`, [userId]);
  return result.changes;
}

/**
 * Delete expired sessions (cleanup)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = run(`DELETE FROM user_sessions WHERE expires_at <= datetime('now')`);
  return result.changes;
}

/**
 * Validate a session token and return the session if valid
 */
export async function validateSession(token: string): Promise<UserSession | null> {
  return getSessionByToken(token);
}
