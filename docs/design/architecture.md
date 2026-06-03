# Architecture — Design Document

**Status:** Draft  
**Author:** Henry Nwaokonko  
**Date:** 2026-05-29  

---

## Overview

High-level system architecture for the Time Tracker web application. This document covers the technology stack, deployment topology, folder structure, and key architectural decisions.

## Goals

- Define the full-stack architecture in a monorepo with a dedicated Go backend service
- Keep infrastructure simple and low-maintenance for an MVP team
- Ensure the frontend is type-safe (TypeScript throughout)
- Enable fast local development with minimal setup
- Leverage SSR for improved performance and SEO via Next.js + React

## Non-Goals

- Additional microservices beyond the single Go API (out of scope for MVP)
- Mobile app architecture
- Real-time collaboration features (e.g. WebSockets)
- Multi-tenancy across organisations (single-team per workspace for MVP)

---

## Design

### Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js 14 (App Router) + React + TypeScript | SSR/SSG out of the box, file-based routing, React Server Components |
| Backend | Go (REST API) | Statically typed, fast, low memory footprint, strong standard library for HTTP |
| Database | PostgreSQL | Relational model fits time-tracking data; strong ecosystem |
| DB Migrations | Goose | Simple, Go-native migration tool; SQL-first, version-controlled schema changes |
| Auth | NextAuth.js (v5) | Handles sessions and credentials on the frontend; JWT passed to Go API |
| Styling | shadcn/ui + Tailwind CSS | Pre-built accessible components on top of Tailwind; consistent design system |
| Hosting | Vercel (frontend) + Fly.io / Railway (Go API) | Zero-config Next.js deploys; Go binary hosting with minimal ops |
| Database Hosting | Neon (managed Postgres) | Serverless Postgres, free tier, easy connection pooling |
| Local Dev DB | Docker Compose (Postgres) | Reproducible local environment |

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│            (Next.js React — App Router)                 │
└───────────┬─────────────────────────────┬───────────────┘
            │ HTTPS (page requests)        │ HTTPS (API calls)
┌───────────▼───────────────┐  ┌──────────▼───────────────┐
│     Vercel Edge Network    │  │      Go REST API          │
│   ┌───────────────────┐   │  │  ┌────────────────────┐  │
│   │   Next.js App     │   │  │  │  Route Handlers    │  │
│   │ React Server Comp │   │  │  │  Business Logic    │  │
│   │ SSR page renders  │   │  │  │  Auth middleware   │  │
│   └───────────────────┘   │  │  └─────────┬──────────┘  │
└───────────────────────────┘  └────────────┼─────────────┘
                                            │ TLS
                               ┌────────────▼─────────────┐
                               │   Neon — Managed Postgres │
                               └──────────────────────────┘
```

### Folder Structure

```
time-tracker/
├── frontend/                      # Next.js application
│   ├── src/
│   │   ├── app/                   # Next.js App Router pages
│   │   │   ├── (auth)/            # Login, register, invite pages
│   │   │   └── (app)/             # Protected app pages
│   │   │       ├── dashboard/
│   │   │       ├── projects/
│   │   │       ├── time-entries/
│   │   │       ├── reports/
│   │   │       └── settings/
│   │   ├── components/
│   │   │   ├── ui/                # shadcn/ui primitives
│   │   │   └── features/          # Feature-specific components (TimerWidget)
│   │   ├── lib/
│   │   │   ├── api.ts             # Typed fetch client for Go API
│   │   │   ├── auth.ts            # NextAuth config
│   │   │   └── utils.ts           # Shared utilities
│   │   └── types/                 # Shared TypeScript types
│   ├── package.json
│   └── .env.example
├── backend/                       # Go REST API
│   ├── cmd/
│   │   └── server/
│   │       └── main.go            # Entry point
│   ├── internal/
│   │   ├── handler/               # HTTP route handlers
│   │   ├── service/               # Business logic
│   │   ├── repository/            # Database queries
│   │   └── middleware/            # Auth, logging, CORS
│   ├── go.mod
│   └── .env.example
├── migrations/                    # Goose SQL migration files
│   ├── 00001_create_users.sql
│   ├── 00002_create_projects.sql
│   └── ...
├── docker-compose.yml             # Local Postgres + services
└── .github/
    └── workflows/
        └── ci.yml                 # GitHub Actions CI
```

### Data Flow

1. **Page requests (SSR):** Next.js renders pages server-side via React Server Components. For initial data, Server Components call the Go API directly on the server before sending HTML to the browser.
2. **Client mutations:** Client-side React components call the Go REST API, which validates the JWT session token, authorises the request, and writes to the database.
3. **Database changes:** All schema changes are managed by Goose migrations in `/migrations/`, run manually or as part of CI/CD before deployment.
4. **Auth:** NextAuth.js manages session cookies on the frontend. On sign-in it issues a JWT that is forwarded as a `Bearer` token to the Go API. The Go API validates the JWT on every protected request.

### Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Frontend/backend split | Separate services in a monorepo | Go backend is a distinct process; frontend and backend share one repo for easier coordination |
| Rendering strategy | SSR via React Server Components | Pages rendered on the server; fast initial load, SEO-friendly, no client waterfall for data |
| Go for backend | Go REST API | Fast, statically typed, excellent HTTP stdlib, easy to deploy as a single binary |
| DB migration tool | Goose | SQL-first migrations, Go-native, straightforward version management |
| Component library | shadcn/ui | Accessible, unstyled-by-default components built on Tailwind; copy-owned, not a locked-in dependency |
| Session strategy | JWT (NextAuth) verified by Go API | Stateless; Go API can validate without a shared session store |

### Environment Variables

**Frontend (`frontend/.env`)**

| Variable | Description |
|---|---|
| `NEXTAUTH_SECRET` | Secret for signing session tokens |
| `NEXTAUTH_URL` | Public URL of the frontend app |
| `NEXT_PUBLIC_API_URL` | Base URL of the Go REST API |
| `EMAIL_SERVER` | SMTP connection string for invite emails |
| `EMAIL_FROM` | From address for outgoing emails |

**Backend (`backend/.env`)**

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Secret for verifying JWTs issued by NextAuth |
| `PORT` | Port the Go API listens on |

## Open Questions

- Which Go HTTP framework to use? (Options: `net/http` stdlib, Chi, Echo, Gin — Chi is a lightweight default)
- Use `sqlc` for type-safe SQL queries in Go, or raw `database/sql` with `pgx`?
- Do we need a job queue for sending invite emails, or is inline sending acceptable for MVP? (Inline is fine for low volume)
