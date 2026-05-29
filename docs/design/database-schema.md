# Database Schema — Design Document

**Status:** Draft  
**Author:** Henry Nwaokonko  
**Date:** 2026-05-29  

---

## Overview

PostgreSQL database schema for the Time Tracker application, defined using Prisma ORM. Covers all entities, relationships, indexes, and business rules.

## Goals

- Model all entities identified in the requirements document
- Define indexes that support the most common query patterns
- Keep the schema simple and easy to evolve for MVP

## Non-Goals

- Soft-delete pattern for all entities (only projects and tasks use `archivedAt`)
- Multi-organisation support
- Audit log table (out of scope for MVP)

---

## Design

### Entity Relationship Diagram

```
Team ──────< User
 │               │
 └──────< Project │
              │    │
              └──< Task ──< TimeEntry >── User
                                │
Team ──────< InviteToken
```

### Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Team {
  id          String        @id @default(cuid())
  name        String
  createdAt   DateTime      @default(now())
  users       User[]
  projects    Project[]
  inviteTokens InviteToken[]
}

model User {
  id           String      @id @default(cuid())
  name         String
  email        String      @unique
  passwordHash String
  role         Role        @default(MEMBER)
  teamId       String
  createdAt    DateTime    @default(now())
  team         Team        @relation(fields: [teamId], references: [id])
  timeEntries  TimeEntry[]
  sessions     Session[]
  accounts     Account[]

  @@index([teamId])
}

enum Role {
  ADMIN
  MEMBER
}

model Project {
  id          String    @id @default(cuid())
  name        String
  description String?
  teamId      String
  archivedAt  DateTime?
  createdAt   DateTime  @default(now())
  team        Team      @relation(fields: [teamId], references: [id])
  tasks       Task[]

  @@index([teamId, archivedAt])
}

model Task {
  id          String      @id @default(cuid())
  name        String
  projectId   String
  archivedAt  DateTime?
  createdAt   DateTime    @default(now())
  project     Project     @relation(fields: [projectId], references: [id])
  timeEntries TimeEntry[]

  @@index([projectId, archivedAt])
}

model TimeEntry {
  id              String    @id @default(cuid())
  userId          String
  taskId          String
  startedAt       DateTime
  endedAt         DateTime?
  durationSeconds Int?
  description     String?
  createdAt       DateTime  @default(now())
  user            User      @relation(fields: [userId], references: [id])
  task            Task      @relation(fields: [taskId], references: [id])

  @@index([userId, startedAt])
  @@index([taskId])
}

model InviteToken {
  id        String    @id @default(cuid())
  email     String
  teamId    String
  token     String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
  team      Team      @relation(fields: [teamId], references: [id])

  @@index([token])
  @@index([teamId])
}

// NextAuth required models
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

### Index Strategy

| Index | Query it supports |
|---|---|
| `User(teamId)` | List all users in a team |
| `Project(teamId, archivedAt)` | List active projects for a team |
| `Task(projectId, archivedAt)` | List active tasks for a project |
| `TimeEntry(userId, startedAt)` | Dashboard totals, user time history, reports |
| `TimeEntry(taskId)` | Aggregate time per task |
| `InviteToken(token)` | Invite link lookup on registration |

### Business Rules Enforced at Application Layer

- `TimeEntry.endedAt` must be after `TimeEntry.startedAt` — validated in API route before write.
- A user may have at most one `TimeEntry` where `endedAt IS NULL` (active timer) — checked before starting a new timer.
- `TimeEntry.durationSeconds` is computed as `endedAt - startedAt` in seconds when the timer is stopped — never sent from the client.
- Invite tokens expire after 7 days (`expiresAt = now + 7 days`) and can only be used once (`usedAt` is set on use).

### Migration Strategy

- Migrations are managed with `prisma migrate dev` locally and `prisma migrate deploy` in CI/CD.
- Each schema change produces a timestamped migration file committed to the repo.
- Breaking migrations (column renames, drops) require a two-phase deploy: add new → migrate data → remove old.

## Open Questions

- Should `durationSeconds` be stored, or always computed from `startedAt`/`endedAt`? (Stored — needed for manual entries where start/end times may not be set precisely.)
- Do we need a `PasswordResetToken` model? (Yes — add in a follow-up migration before auth implementation.)
