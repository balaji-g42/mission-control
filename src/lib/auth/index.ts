/**
 * Authentication utilities for Mission Control
 * Central export point for all auth-related functionality
 */

import { NextRequest } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { validateSession, createSession, deleteSession } from './session';
import { hashPassword, verifyPassword, generateRandomPassword, validatePassword, generateResetToken } from './password';

// Re-export all auth utilities
export { 
  // Password utilities
  hashPassword,
  verifyPassword,
  generateRandomPassword,
  validatePassword,
  generateResetToken,
} from './password';

export {
  // Session utilities
  createSession,
  deleteSession,
  deleteUserSessions,
  validateSession,
} from './session';

// Configuration from environment
export const MAX_LOGIN_ATTEMPTS = parseInt(process.env.AUTH_MAX_LOGIN_ATTEMPTS || '5', 10);
export const LOCKOUT_DURATION_MINUTES = parseInt(process.env.AUTH_LOCKOUT_DURATION_MINUTES || '15', 10);
export const SESSION_EXPIRY_HOURS = parseInt(process.env.AUTH_SESSION_EXPIRY_HOURS || '24', 10);

export interface User {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  role: 'admin' | 'viewer';
  is_active: number;
  must_change_password: number;
  failed_login_attempts: number;
  locked_until: string | null;
  two_factor_enabled: number;
  two_factor_secret: string | null;
  recovery_codes: string | null;
  password_reset_token: string | null;
  password_reset_expires: string | null;
  last_login_at: string | null;
  last_login_ip: string | null;
  created_at: string;
  updated_at: string;
}

export type AuditEventType = 
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'password_changed'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | '2fa_enabled'
  | '2fa_disabled'
  | '2fa_verified'
  | '2fa_recovery_used'
  | 'account_locked'
  | 'account_unlocked'
  | 'registration'
  | 'force_password_change';

/**
 * Check if any users exist in the database
 */
export async function anyUsersExist(): Promise<boolean> {
  const user = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');
  return (user?.count ?? 0) > 0;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const user = queryOne<User>('SELECT * FROM users WHERE email = ?', [email]);
  return user ?? null;
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  const user = queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
  return user ?? null;
}

/**
 * Create a new user
 */
export async function createUser(
  email: string,
  passwordHash: string,
  salt: string,
  role: 'admin' | 'viewer' = 'admin',
  mustChangePassword: boolean = true
): Promise<User> {
  const { v4: uuidv4 } = await import('uuid');
  const id = uuidv4();

  run(
    `INSERT INTO users (id, email, password_hash, salt, role, must_change_password, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, email, passwordHash, salt, role, mustChangePassword ? 1 : 0]
  );

  const user = await getUserById(id);
  if (!user) throw new Error('Failed to create user');
  return user;
}

/**
 * Check if user account is locked
 */
export function isAccountLocked(user: User): boolean {
  if (!user.locked_until) return false;
  return new Date(user.locked_until) > new Date();
}

/**
 * Lock user account after too many failed attempts
 */
export async function lockAccount(userId: string): Promise<void> {
  const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString();
  run(
    `UPDATE users SET locked_until = ?, failed_login_attempts = 0, updated_at = datetime('now') WHERE id = ?`,
    [lockUntil, userId]
  );
}

/**
 * Reset failed login attempts
 */
export async function resetFailedAttempts(userId: string): Promise<void> {
  run(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?`,
    [userId]
  );
}

/**
 * Increment failed login attempts
 */
export async function incrementFailedAttempts(userId: string): Promise<number> {
  run(
    `UPDATE users SET failed_login_attempts = failed_login_attempts + 1, updated_at = datetime('now') WHERE id = ?`,
    [userId]
  );
  
  const user = await getUserById(userId);
  return user?.failed_login_attempts ?? 0;
}

/**
 * Update user's last login info
 */
export async function updateLastLogin(userId: string, ipAddress: string): Promise<void> {
  run(
    `UPDATE users SET last_login_at = datetime('now'), last_login_ip = ?, updated_at = datetime('now') WHERE id = ?`,
    [ipAddress, userId]
  );
}

/**
 * Set must_change_password flag
 */
export async function setMustChangePassword(userId: string, mustChange: boolean): Promise<void> {
  run(
    `UPDATE users SET must_change_password = ?, updated_at = datetime('now') WHERE id = ?`,
    [mustChange ? 1 : 0, userId]
  );
}

/**
 * Update user password
 */
export async function updateUserPassword(userId: string, passwordHash: string, salt: string): Promise<void> {
  run(
    `UPDATE users SET password_hash = ?, salt = ?, must_change_password = 0, password_reset_token = NULL, password_reset_expires = NULL, updated_at = datetime('now') WHERE id = ?`,
    [passwordHash, salt, userId]
  );
}

/**
 * Set password reset token
 */
export async function setPasswordResetToken(userId: string, token: string): Promise<void> {
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
  run(
    `UPDATE users SET password_reset_token = ?, password_reset_expires = ?, updated_at = datetime('now') WHERE id = ?`,
    [token, expires, userId]
  );
}

/**
 * Get user by password reset token
 */
export async function getUserByResetToken(token: string): Promise<User | null> {
  const user = queryOne<User>(
    `SELECT * FROM users WHERE password_reset_token = ? AND password_reset_expires > datetime('now')`,
    [token]
  );
  return user ?? null;
}

/**
 * Clear password reset token
 */
export async function clearPasswordResetToken(userId: string): Promise<void> {
  run(
    `UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL, updated_at = datetime('now') WHERE id = ?`,
    [userId]
  );
}

/**
 * Log authentication event to audit log
 */
export async function logAuthEvent(
  eventType: AuditEventType,
  userId?: string,
  ipAddress?: string,
  userAgent?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const { v4: uuidv4 } = await import('uuid');
  const id = uuidv4();
  
  run(
    `INSERT INTO auth_audit_log (id, user_id, event_type, ip_address, user_agent, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [id, userId || null, eventType, ipAddress || null, userAgent || null, metadata ? JSON.stringify(metadata) : null]
  );
}

/**
 * Get session cookie name
 */
export function getSessionCookieName(): string {
  return 'mc_session';
}

/**
 * Get session from request cookies
 */
export async function getSessionFromRequest(request: NextRequest) {
  const cookieName = getSessionCookieName();
  const token = request.cookies.get(cookieName)?.value;
  
  if (!token) return null;
  
  return validateSession(token);
}

/**
 * Get current user from request
 */
export async function getCurrentUser(request: NextRequest): Promise<User | null> {
  const session = await getSessionFromRequest(request);
  if (!session) return null;
  
  return getUserById(session.user_id);
}