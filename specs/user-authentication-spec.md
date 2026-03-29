# User Authentication System - Implementation Plan

## Overview

This document outlines the implementation plan for adding proper user authentication to Mission Control, including username/password login, 2FA (TOTP), account lockout, and 2FA recovery codes.

---

## Current State

- **Tech Stack:** Next.js 14 (App Router), SQLite (better-sqlite3), React 18, TypeScript, Tailwind CSS
- **Current Auth:** Session-based authentication with database-stored tokens
- **No user management, sessions, or login pages**

---

## Architecture Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| **User Roles** | `admin` only | Expand to RBAC later |
| **Session Storage** | Server-side (SQLite) | More secure than JWT, revocable, no token exposure |
| **Initial Password** | User-provided during setup | User chooses their own secure password |
| **2FA Method** | TOTP only | Google Authenticator, Authy compatible |
| **2FA Requirement** | **Recommended** | Encouraged after setup, not blocking |
| **Password Reset** | **2FA Recovery Codes only** | No mail server available |

---

## Current Implementation (As Built)

### Setup Flow
1. User visits `/setup` page
2. User enters email and chooses password (user-provided, not random)
3. User confirms password
4. Account created and user is automatically logged in
5. Redirect to dashboard
6. 2FA setup is recommended via info banner but not mandatory

### Login Flow
1. User visits `/login` page
2. User enters email and password
3. System validates credentials
4. Account lockout after 5 failed attempts (15-minute lockout)
5. On success, session created and cookie set
6. Redirect to dashboard

### 2FA (Optional)
- 2FA setup is available in Settings → Security
- User can enable 2FA at any time
- TOTP with QR code for authenticator apps
- 10 recovery codes generated during setup
- 2FA is NOT required to access the dashboard
- 2FA is recommended but not blocking

### Password Reset (Requires 2FA)
- Password reset requires valid 2FA code (TOTP or Recovery Code)
- Without 2FA enabled, password reset is NOT possible
- Alternative: Contact system administrator

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

## Security Specifications (Current Implementation)

### Password Requirements
- Minimum 12 characters
- Must contain: uppercase, lowercase, number, symbol
- Bcrypt with 12 salt rounds
- No forced password change after setup

### Session Management
- 64-byte random hex token
- HttpOnly, Secure, SameSite=Strict cookie
- 24-hour expiry
- Stored in SQLite (revocable)

### Account Lockout
- 5 failed attempts → 15-minute lockout
- Track by IP + username combination
- Audit log for all attempts

### 2FA (TOTP) - OPTIONAL
- 32-character base32 secret
- 30-second time step
- 6-digit code
- 10 recovery codes (single-use, bcrypt hashed)
- QR code for authenticator apps (Google Authenticator, Authy)
- **2FA is recommended but not required to access the system**

### Password Reset (Requires 2FA)
- Requires valid 2FA code (TOTP or Recovery Code)
- Recovery code is consumed after use
- User must have 2FA enabled to reset password
- Without 2FA, password reset is NOT possible
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
- [x] Update src/middleware.ts (session validation from user_sessions table)
- [x] Add setup redirect (no users → /setup)
- [x] Add login redirect (no session → /login)
- [x] Add 2FA warning redirect (no 2FA → show warning)
- [x] Removed MC_API_TOKEN - now using session tokens from database
- [x] Update .env.example

### Phase 8: Testing & Documentation
- [ ] Unit tests for password hashing
- [ ] Unit tests for 2FA
- [ ] Integration tests for auth flows
- [ ] Update README with auth documentation
- [ ] Update PRODUCTION_SETUP.md

---

## Initial Setup Flow (Current Implementation)

```
1. App starts → Check if any users exist
2. If no users → Redirect to /setup page
3. Setup page shows:
   - Email input field
   - Password input field (user chooses their own)
   - Confirm password field
   - Info banner explaining 2FA will be required

4. User enters email and chooses password
5. User submits form → Account created
6. User is automatically logged in (session created)
7. Redirect to dashboard
8. 2FA setup is recommended but not mandatory
```

### Key Differences from Original Spec
- **No random password** — User provides their own password
- **No console logging** — Password is not displayed in console
- **No forced password change** — User's password is immediately valid
- **Immediate login** — Session created on setup, no separate login required
- **2FA recommended, not mandatory** — User can access dashboard without 2FA

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

## API Authentication (Current Implementation)

### How It Works
- **Session tokens from database** — API authentication uses tokens stored in `user_sessions` table
- **Token rotation** — New session token generated on each login
- **24-hour expiry** — Tokens automatically expire after 24 hours
- **No static tokens** — No environment variables needed for API auth

### Internal API Calls
- Server-side code uses `getAuthHeaders()` from `@/lib/auth/api-token`
- Fetches any valid session token from database
- Includes in `Authorization: Bearer <token>` header

### Middleware Validation
- Incoming Bearer tokens validated against `user_sessions` table
- `getSessionByToken()` checks token exists and is not expired
- Same-origin browser requests allowed without token check

### Token Lifecycle
```
User logs in → Session created → Token stored in DB
Internal calls → Fetch token from DB → Use in API calls
User logs out → Session deleted → Token invalidated
24 hours pass → Token expires → Must re-login
```

## Backward Compatibility

- Session-based authentication is the primary auth method
- Browser UI uses session-based auth (cookies)
- External API calls use session tokens from user_sessions table
- Session tokens rotate on each login and expire after 24 hours

---

## Future Enhancements (Out of Scope)

- Role-Based Access Control (RBAC) with multiple roles
- OAuth/SSO integration (Google, GitHub)
- SMS-based 2FA
- Session management UI (view/revoke sessions)
- Multi-user support with user management
- API key management for external integrations
- Email-based password reset (when mail server available)