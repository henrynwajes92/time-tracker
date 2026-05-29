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
**Session type:** Database sessions (stored in the `Session` table via Prisma adapter)  
**Session expiry:** 30 days of inactivity  
**Password hashing:** bcrypt with cost factor 12

Database sessions are preferred over JWTs because:
- Sessions can be revoked immediately (e.g. when a member is removed from a team)
- No risk of stale role/team data being encoded in a long-lived token

### Session Flow

```
1. User submits email + password to POST /api/auth/callback/credentials (NextAuth)
2. Credentials provider fetches User from DB by email
3. bcrypt.compare(inputPassword, user.passwordHash)
4. On success: NextAuth creates a Session row and sets a session cookie (httpOnly, Secure, SameSite=Lax)
5. On subsequent requests: NextAuth reads the session cookie, looks up the Session row, and attaches the User to the request context
6. On logout: Session row is deleted; cookie is cleared
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

Every API route handler follows this pattern:

```
1. const session = await auth()           // get session
2. if (!session) return 401              // not logged in
3. if (needsAdmin && session.user.role !== 'ADMIN') return 403
4. // enforce team scoping: only return/modify resources belonging to session.user.teamId
```

Role is never trusted from the client — always read from the database session.

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
// src/lib/auth.ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: 'database', maxAge: 30 * 24 * 60 * 60 }, // 30 days
  providers: [
    Credentials({
      async authorize(credentials) {
        const user = await db.user.findUnique({ where: { email: credentials.email } })
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null
        return { id: user.id, name: user.name, email: user.email, role: user.role, teamId: user.teamId }
      }
    })
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id
      session.user.role = user.role
      session.user.teamId = user.teamId
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
