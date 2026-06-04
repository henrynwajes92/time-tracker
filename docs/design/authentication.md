# Authentication — Design Document

**Status:** Draft  
**Author:** Henry Nwaokonko  
**Date:** 2026-05-29  

---

## Overview

Authentication and authorisation design for the Time Tracker application using NextAuth.js v5 with a credentials provider (email + password). Covers session management, protected routes, the team invite flow, and password reset.

## Goals

- Secure email/password authentication with server-side session management
- Role-based route and API protection (Admin vs Member)
- Team invite flow so admins can onboard new members
- Password reset via email

## Non-Goals

- OAuth / social login providers (Google, GitHub) — can be added later
- Two-factor authentication — out of scope for MVP
- Single sign-on (SSO) — future consideration

---

## Design

### Authentication Strategy

**Provider:** NextAuth.js Credentials provider  
**Session type:** JWT (stateless — no database session table required)  
**Token expiry:** 30 days  
**Password hashing:** bcrypt with cost factor 12

JWTs are used because the Go API needs to validate tokens independently without a shared session store. The JWT is signed with `NEXTAUTH_SECRET` (shared between Next.js and Go API) and contains `id`, `email`, `role`, and `teamId`. The Go API validates the signature on every protected request using the same secret.

### Session Flow

```
1. User submits email + password to POST /api/auth/callback/credentials (NextAuth, on the Next.js frontend)
2. Credentials provider calls Go API POST /api/auth/verify to validate credentials
3. Go API fetches User from DB by email, runs bcrypt.compare(inputPassword, user.passwordHash)
4. On success: NextAuth signs a JWT containing { id, email, role, teamId } using NEXTAUTH_SECRET and sets an httpOnly session cookie
5. On client API calls: Next.js reads the JWT from the session cookie and forwards it as Authorization: Bearer <token> to the Go API
6. Go API validates the JWT signature using NEXTAUTH_SECRET on every protected request
7. On logout: NextAuth clears the session cookie (no server-side revocation needed)
```

### Protected Routes — middleware.ts

```
src/middleware.ts
```

All routes under `/(app)/` are protected. The middleware runs on every request and redirects unauthenticated users to `/login`.

```
Public routes:  /login, /register, /register/invite, /auth/reset-password/**
Protected:      everything else
```

Admin-only pages (e.g. `/settings/team`) additionally check `session.user.role === 'ADMIN'` and return a 403 or redirect to `/dashboard` if a member attempts access.

### API Route Authorisation Pattern

Every protected Go API handler uses a middleware chain:

```
1. Extract Bearer token from Authorization header → 401 if missing
2. Validate JWT signature using NEXTAUTH_SECRET → 401 if invalid or expired
3. Parse claims: { id, email, role, teamId }
4. if needsAdmin && claims.role != "ADMIN" → return 403
5. Enforce team scoping: only return/modify resources where teamId = claims.teamId
```

Role is never trusted from the client — always read from the signed JWT claims.

---

### Team Invite Flow

```
Admin                          Server                        Invitee
  │                               │                              │
  │─ POST /api/auth/invite ───────▶│                              │
  │  { email: "bob@example.com" }  │                              │
  │                                │ 1. Create InviteToken row    │
  │                                │    (token = crypto random,   │
  │                                │     expiresAt = now + 7d)    │
  │                                │ 2. Send email with link:     │
  │                                │    /register/invite?token=…  │
  │◀─ 200 "Invite sent" ──────────│                              │
  │                                │                              │
  │                                │◀─ GET /register/invite?token ─│
  │                                │ 3. Validate token (not        │
  │                                │    expired, not used)         │
  │                                │─ Show registration form ────▶│
  │                                │                              │
  │                                │◀─ POST /api/auth/register/invite
  │                                │   { name, email, password, token }
  │                                │ 4. Re-validate token          │
  │                                │ 5. Create User (role=MEMBER)  │
  │                                │ 6. Mark token usedAt=now      │
  │                                │ 7. Create session + set cookie│
  │                                │─ 201 + redirect /dashboard ─▶│
```

**Token generation:** `crypto.randomBytes(32).toString('hex')` — 256 bits of entropy.  
**Token expiry:** 7 days from creation.  
**Single use:** `InviteToken.usedAt` is set on first use; subsequent attempts with the same token return 400.

---

### Password Reset Flow

```
User                           Server
  │                               │
  │─ POST /api/auth/reset-password/request
  │  { email: "jane@example.com" }│
  │                               │ 1. Look up User by email
  │                               │ 2. If found: create VerificationToken
  │                               │    (expires in 1 hour)
  │                               │ 3. Send reset email with link:
  │                               │    /auth/reset-password?token=…
  │◀─ 200 (always, to avoid enumeration)
  │                               │
  │─ POST /api/auth/reset-password/confirm
  │  { token, password }          │
  │                               │ 4. Validate token (exists, not expired)
  │                               │ 5. Hash new password with bcrypt
  │                               │ 6. Update User.passwordHash
  │                               │ 7. Delete all existing sessions (force re-login)
  │                               │ 8. Delete used token
  │◀─ 200 "Password updated"     │
```

**Enumeration protection:** The `/request` endpoint always returns 200 regardless of whether the email exists.  
**Session invalidation:** All existing sessions are deleted after a password reset to prevent session fixation.

---

### NextAuth Configuration Summary

```ts
// frontend/src/lib/auth.ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 days, no DB needed
  providers: [
    Credentials({
      async authorize(credentials) {
        // Delegate credential validation to the Go API
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: credentials.email, password: credentials.password }),
        })
        if (!res.ok) return null
        const user = await res.json()
        return { id: user.id, name: user.name, email: user.email, role: user.role, teamId: user.teamId }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.teamId = user.teamId
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      session.user.teamId = token.teamId as string
      return session
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  }
})
```

---

## Open Questions

- Should we add Google OAuth as an alternative login? (Deferred — add after MVP ships)
- Do we need email verification on registration (before allowing login)? (Skip for MVP — invite flow is sufficient assurance for team members)
