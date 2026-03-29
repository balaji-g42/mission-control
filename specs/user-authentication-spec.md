# User Authentication System - Implementation Plan

## Overview

This document outlines the implementation plan for adding proper user authentication to Mission Control, including username/password login, 2FA (TOTP), account lockout, and 2FA recovery codes.

---

## Current State

- **Tech Stack:** Next.js 14 (App Router), SQLite (better-sqlite3), React 18, TypeScript, Tailwind CSS
- **Current Auth:** Single `MC_API_TOKEN` environment variable with Bearer token validation
- **No user management, sessions, or login pages**

---

## Architecture Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| **User Roles** | `admin` only | Expand to RBAC later |
| **Session Storage** | Server-side (SQLite) | More secure than JWT, revocable, no token exposure |
| **Initial Password** | Random → Force change on first login | Security best practice |
| **2FA Method** | TOTP only | Google Authenticator, Authy compatible |
| **2FA Requirement** | **MANDATORY** | Must complete 2FA setup before accessing the system |
| **Password Reset** | **2FA Recovery Codes only** | No mail server available |

---

## Updated Security Model

### 2FA is Mandatory
- Users MUST complete 2FA setup before accessing the dashboard
- Until 2FA is setup, show a persistent warning banner
- If 2FA is not enabled, redirect to 2FA setup page

### Password Reset Flow (No Email)
1. User requests password reset at `/forgot-password`
2. System verifies 2FA code (TOTP or Recovery Code)
3. If valid, allow password reset
4. This is the ONLY way to reset password (no email available)

### Recovery Codes
- 10 single-use codes generated during 2FA setup
- Each code can be used once to login if TOTP device is unavailable
- Also used for password reset verification
- Users should save these codes securely

---

## Database Schema Changes

### Migration 029: User Authentication Tables

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'viewer')),
  is_active INTEGER DEFAULT 1,
  must_change_password INTEGER DEFAULT 1,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TEXT,
  two_factor_enabled INTEGER DEFAULT 0,
  two_factor_secret TEXT,
  recovery_codes TEXT,
  password_reset_token TEXT,
  password_reset_expires TEXT,
  last_login_at TEXT,
  last_login_ip TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Auth audit log table
CREATE TABLE IF NOT EXISTS auth_audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'login_success', 'login_failed', 'logout', 'password_changed',
    'password_reset_requested', 'password_reset_completed',
    '2fa_enabled', '2fa_disabled', '2fa_verified', '2fa_recovery_used',
    'account_locked', 'account_unlocked', 'registration', 'force_password_change'
  )),
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## Required NPM Packages

```bash
npm install bcryptjs otplib qrcode nodemailer
npm install -D @types/bcryptjs @types/nodemailer @types/qrcode
```

| Package | Purpose |
|---------|---------|
| `bcryptjs` | Password hashing (12 salt rounds) |
| `otplib` | TOTP 2FA generation/verification |
| `qrcode` | QR code generation for 2FA setup |
| `nodemailer` | Email sending via SMTP (console provider for dev) |

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       ├── status/route.ts         # GET: Auth system status (users exist?)
│   │       ├── setup/route.ts          # POST: Initial admin registration
│   │       ├── login/route.ts          # POST: Login with email/password
│   │       ├── logout/route.ts         # POST: Logout (invalidate session)
│   │       ├── me/route.ts             # GET: Current user info
│   │       ├── password/
│   │       │   ├── change/route.ts     # POST: Change password (logged in)
│   │       │   ├── reset/route.ts      # POST: Reset password with 2FA verification
│   │       │   └── forgot/route.ts     # POST: Request password reset (requires 2FA)
│   │       ├── 2fa/
│   │       │   ├── setup/route.ts      # POST: Generate 2FA secret + QR
│   │       │   ├── verify/route.ts     # POST: Verify 2FA code
│   │       │   ├── disable/route.ts    # POST: Disable 2FA (requires password)
│   │       │   └── recovery/route.ts   # POST: Login with recovery code
│   │       └── session/route.ts        # GET: List active sessions
│   ├── login/
│   │   └── page.tsx                    # Login page
│   ├── setup/
│   │   └── page.tsx                    # Initial admin setup page
│   ├── forgot-password/
│   │   └── page.tsx                    # Password reset page (requires 2FA)
│   └── settings/
│       └── security/
│           └── page.tsx                # Security settings (2FA, password)
├── lib/
│   ├── auth/
│   │   ├── index.ts                    # Auth utilities, middleware helpers
│   │   ├── password.ts                 # Password hashing/verification
│   │   ├── session.ts                  # Session CRUD operations
│   │   ├── two-factor.ts              # TOTP generation/verification
│   │   ├── recovery-codes.ts          # Recovery code generation/validation
│   │   └── rate-limit.ts              # Login attempt rate limiting
│   ├── email/
│   │   ├── index.ts                    # Email service factory
│   │   └── providers/
│   │       └── console.ts              # Console provider (dev mode)
│   └── db/
│       └── migrations.ts               # Add migration 029
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx               # Login form component
│   │   ├── TwoFactorForm.tsx           # 2FA code input
│   │   ├── SetupForm.tsx               # Initial setup form
│   │   └── TwoFactorWarning.tsx        # Warning banner for 2FA not setup
│   └── settings/
│       └── SecuritySettings.tsx        # Security settings component
└── middleware.ts                        # Update for session-based auth + 2FA check
```

---

## Security Specifications

### Password Requirements
- Minimum 12 characters
- Must contain: uppercase, lowercase, number, symbol
- Bcrypt with 12 salt rounds
- Force change after initial setup

### Session Management
- 64-byte random hex token
- HttpOnly, Secure, SameSite=Strict cookie
- 24-hour expiry (configurable)
- Stored in SQLite (revocable)

### Account Lockout
- 5 failed attempts → 15-minute lockout
- Track by IP + username combination
- Audit log for all attempts

### 2FA (TOTP) - MANDATORY
- 32-character base32 secret
- 30-second time step
- 6-digit code
- 10 recovery codes (single-use, bcrypt hashed)
- QR code for authenticator apps (Google Authenticator, Authy)
- **Users cannot access the system until 2FA is enabled**

### Password Reset (No Email)
- Requires valid 2FA code (TOTP or Recovery Code)
- Recovery code is consumed after use
- User must have 2FA enabled to reset password
- Alternative: Contact system administrator

---

## API Endpoints

### Public Endpoints (No Auth Required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/status` | Check if setup needed |
| POST | `/api/auth/setup` | Initial admin registration |
| POST | `/api/auth/login` | Authenticate user |
| POST | `/api/auth/logout` | Destroy session |
| POST | `/api/auth/password/forgot` | Request password reset (requires 2FA) |
| POST | `/api/auth/password/reset` | Reset password with 2FA verification |
| POST | `/api/auth/2fa/recovery` | Login with recovery code |

### Protected Endpoints (Session Required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/me` | Current user info |
| POST | `/api/auth/password/change` | Change password |
| POST | `/api/auth/2fa/setup` | Generate TOTP secret + QR |
| POST | `/api/auth/2fa/verify` | Verify TOTP code and enable 2FA |
| POST | `/api/auth/2fa/disable` | Disable 2FA (requires password) |
| GET | `/api/auth/session` | List active sessions |

---

## UI Components

### TwoFactorWarning Component
- Shown on all pages when 2FA is not enabled
- Dismissible but reappears on page refresh
- Links to 2FA setup page
- Prevents access to main dashboard until 2FA is setup

### Forgot Password Page
- Email input
- 2FA code input (TOTP or Recovery Code)
- New password input
- Confirm password input

---

## Implementation Phases

### Phase 1: Core Infrastructure
- [x] Install npm dependencies (bcryptjs, otplib, qrcode, nodemailer)
- [x] Install TypeScript type definitions
- [x] Create migration 029 (users, sessions, audit_log tables)
- [x] Create src/lib/auth/password.ts (bcryptjs hashing)
- [x] Create src/lib/auth/session.ts (session CRUD)
- [x] Create src/lib/auth/index.ts (utilities)

### Phase 2: Initial Setup Flow
- [x] Create GET /api/auth/status (check if users exist)
- [x] Create POST /api/auth/setup (first admin registration)
- [x] Create GET /setup page (initial admin form)

### Phase 3: Login System
- [x] Create POST /api/auth/login (authenticate)
- [x] Create POST /api/auth/logout (invalidate session)
- [x] Create GET /api/auth/me (current user)
- [x] Create GET /login page
- [x] Update middleware for session-based auth

### Phase 4: Password Reset (2FA Only)
- [ ] Create email service (console provider only)
- [ ] Create POST /api/auth/password/forgot (requires 2FA)
- [ ] Create POST /api/auth/password/reset (with 2FA verification)
- [ ] Create POST /api/auth/password/change
- [ ] Create GET /forgot-password page

### Phase 5: Two-Factor Authentication
- [x] Create src/lib/auth/two-factor.ts (TOTP)
- [x] Create src/lib/auth/recovery-codes.ts (10 codes)
- [x] Create POST /api/auth/2fa/setup (secret + QR)
- [x] Create POST /api/auth/2fa/verify (verify code)
- [x] Create POST /api/auth/2fa/disable
- [x] Create POST /api/auth/2fa/recovery (recovery code login)
- [x] Update login flow for 2FA

### Phase 6: UI Components
- [x] Create LoginForm.tsx
- [x] Create TwoFactorForm.tsx
- [x] Create SetupForm.tsx
- [ ] Create SecuritySettings.tsx
- [ ] Create TwoFactorWarning.tsx (mandatory 2FA banner)
- [x] Create /login page
- [x] Create /setup page
- [ ] Create /forgot-password page
- [ ] Create /settings/security page

### Phase 7: Middleware & Integration
- [ ] Update src/middleware.ts (session validation + 2FA check)
- [ ] Add setup redirect (no users → /setup)
- [ ] Add login redirect (no session → /login)
- [ ] Add 2FA warning redirect (no 2FA → show warning)
- [ ] Maintain MC_API_TOKEN backward compatibility
- [ ] Update .env.example

### Phase 8: Testing & Documentation
- [ ] Unit tests for password hashing
- [ ] Unit tests for 2FA
- [ ] Integration tests for auth flows
- [ ] Update README with auth documentation
- [ ] Update PRODUCTION_SETUP.md

---

## Initial Setup Flow

```
1. App starts → Check if any users exist
2. If no users → Console displays:
   ╔══════════════════════════════════════════╗
   ║  MISSION CONTROL - FIRST RUN SETUP       ║
   ╠══════════════════════════════════════════╣
   ║  No admin account found.                  ║
   ║                                           ║
   ║  Visit: http://localhost:4000/setup       ║
   ║                                           ║
   ║  A random password will be generated.     ║
   ║  You MUST change it after first login.    ║
   ╚══════════════════════════════════════════╝

3. User visits /setup → Enters email
4. System generates random password → Displays in console + UI
5. Console shows:
   ╔══════════════════════════════════════════╗
   ║  ADMIN ACCOUNT CREATED                   ║
   ╠══════════════════════════════════════════╣
   ║  Email: admin@example.com                ║
   ║  Password: Xk9#mP2$vL8@nQ4!             ║
   ║                                           ║
   ║  ⚠️  SAVE THIS PASSWORD NOW!              ║
   ║  ⚠️  You must change it after login.      ║
   ╚══════════════════════════════════════════╝

6. User logs in → Forced to change password
7. After password change → Redirected to 2FA setup (MANDATORY)
8. User MUST complete 2FA setup before accessing dashboard
9. Show warning banner until 2FA is enabled
```

---

## Password Reset Flow (No Email)

```
1. User clicks "Forgot Password" on login page
2. System shows password reset form:
   - Email field
   - 2FA Code field (TOTP or Recovery Code)
   - New Password field
   - Confirm Password field

3. User enters email + 2FA code
4. System verifies:
   - Email exists
   - 2FA code is valid (TOTP or Recovery Code)
   - If using Recovery Code, mark it as used

5. If valid, allow password reset
6. User sets new password
7. Redirect to login page

Note: Without 2FA, password reset is NOT possible
Alternative: Contact system administrator
```

---

## Backward Compatibility

- Keep `MC_API_TOKEN` support for API access (external integrations)
- Browser UI uses session-based auth
- External API calls can use either token or session
- Gradual migration path for existing deployments

---

## Future Enhancements (Out of Scope)

- Role-Based Access Control (RBAC) with multiple roles
- OAuth/SSO integration (Google, GitHub)
- SMS-based 2FA
- Session management UI (view/revoke sessions)
- Multi-user support with user management
- API key management for external integrations
- Email-based password reset (when mail server available)