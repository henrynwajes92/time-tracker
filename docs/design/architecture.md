# Architecture — Design Document

**Status:** Draft  
**Author:** Henry Nwaokonko  
**Date:** 2026-05-29  

---

## Overview

High-level system architecture for the Time Tracker web application. This document covers the technology stack, deployment topology, folder structure, and key architectural decisions.

## Goals

- Define the full-stack architecture in a single deployable monorepo
- Keep infrastructure simple and low-maintenance for an MVP team
- Ensure the architecture is type-safe end-to-end (TypeScript throughout)
- Enable fast local development with minimal setup

## Non-Goals

- Microservices or separate backend service (out of scope for MVP)
- Mobile app architecture
- Real-time collaboration features (e.g. WebSockets)
- Multi-tenancy across organisations (single-team per workspace for MVP)

---

## Design

### Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | Full-stack TS, file-based routing, React Server Components |
| Backend | Next.js API Routes | Co-located with frontend, no separate server to deploy |
| Database | PostgreSQL | Relational model fits time-tracking data; strong ecosystem |
| ORM | Prisma | Type-safe queries, migration tooling, schema-as-code |
| Auth | NextAuth.js (v5) | Handles sessions, credentials provider, Prisma adapter |
| Styling | Tailwind CSS | Utility-first, fast to build, consistent design |
| Hosting | Vercel | Zero-config Next.js deploys, preview URLs per PR |
| Database Hosting | Neon (managed Postgres) | Serverless Postgres, free tier, Vercel integration |
| Local Dev DB | Docker Compose (Postgres) | Reproducible local environment |

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│            (Next.js React — App Router)                 │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼─────────────────────────────────┐
│                  Vercel Edge Network                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Next.js Application                 │   │
│  │  ┌─────────────────┐  ┌───────────────────────┐  │   │
│  │  │  React Pages /  │  │   API Routes          │  │   │
│  │  │  Server Comps   │  │   /api/**             │  │   │
│  │  └────────┬────────┘  └──────────┬────────────┘  │   │
│  │           │                      │               │   │
│  │           └──────────┬───────────┘               │   │
│  │                      │ Prisma Client              │   │
│  └──────────────────────┼───────────────────────────┘   │
└─────────────────────────┼───────────────────────────────┘
                          │ TLS
┌─────────────────────────▼───────────────────────────────┐
│              Neon — Managed PostgreSQL                   │
└─────────────────────────────────────────────────────────┘
```

### Folder Structure

```
time-tracker/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Migration history
├── src/
│   ├── app/                   # Next.js App Router pages
│   │   ├── (auth)/            # Login, register, invite pages
│   │   ├── (app)/             # Protected app pages
│   │   │   ├── dashboard/
│   │   │   ├── projects/
│   │   │   ├── time-entries/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   └── api/               # API route handlers
│   │       ├── auth/
│   │       ├── projects/
│   │       ├── tasks/
│   │       ├── time-entries/
│   │       └── reports/
│   ├── components/            # Shared React components
│   │   ├── ui/                # Generic UI primitives (buttons, inputs)
│   │   └── features/          # Feature-specific components (TimerWidget)
│   ├── lib/
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── auth.ts            # NextAuth config
│   │   └── utils.ts           # Shared utilities
│   └── types/                 # Shared TypeScript types
├── docker-compose.yml         # Local Postgres
├── .env.example               # Environment variable reference
└── .github/
    └── workflows/
        └── ci.yml             # GitHub Actions CI
```

### Data Flow

1. **Page requests:** Next.js Server Components fetch data directly via Prisma (server-side, no API hop).
2. **Mutations:** Client components call API routes (`/api/**`) which validate the session, authorise the request, and write to the database via Prisma.
3. **Auth:** NextAuth.js manages session cookies. `middleware.ts` protects all routes under `/(app)/` — unauthenticated requests redirect to `/login`.

### Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Monorepo vs separate services | Monorepo | Simpler for MVP; one deploy, one repo, shared types |
| Server Components vs API routes | Server Components for reads, API routes for mutations | Reduces round-trips for page loads; keeps mutations explicit |
| ORM | Prisma | Type safety; migration tooling; widely understood |
| Session storage | Database sessions (NextAuth Prisma adapter) | More secure than JWTs for team apps; easy to revoke |

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `NEXTAUTH_SECRET` | Secret for signing session tokens |
| `NEXTAUTH_URL` | Public URL of the app |
| `EMAIL_SERVER` | SMTP connection string for invite emails |
| `EMAIL_FROM` | From address for outgoing emails |

## Open Questions

- Should we use tRPC instead of plain API routes for better end-to-end type safety? (Deferred — plain API routes are sufficient for MVP)
- Do we need a job queue for sending invite emails, or is inline sending acceptable for MVP? (Inline is fine for low volume)
