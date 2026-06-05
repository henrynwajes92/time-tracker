# Time Tracker

A team time-tracking web application. Members log time against projects and tasks using a live timer or manual entry. Admins manage the team, view reports, and export data.

## Features

- **Live timer** — start/stop against a project and task; survives page refresh
- **Manual entry** — log past time with date/time pickers
- **Projects & tasks** — admin creates/archives projects and tasks
- **Team management** — invite members via link, change roles, remove members
- **Dashboard** — today's hours, weekly bar chart, active timer widget
- **Reports** — filter by date range, user, project; export CSV
- **Role-based access** — ADMIN vs MEMBER with enforced server-side checks

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Auth | NextAuth.js v5 (JWT strategy) |
| Backend | Go 1.26, Chi router |
| Database | PostgreSQL 16, Goose migrations |
| Hosting | Vercel (frontend) + Render (Go API) |

---

## Local development

### Prerequisites

- **Node.js** ≥ 20
- **Go** ≥ 1.26
- **Docker** (for local Postgres)
- **Goose** — `go install github.com/pressly/goose/v3/cmd/goose@latest`

### 1. Clone and install

```bash
git clone https://github.com/henrynwajes92/time-tracker.git
cd time-tracker

# Frontend deps
cd frontend && npm install && cd ..
```

### 2. Environment variables

**`frontend/.env.local`**
```env
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
AUTH_SECRET=<same value as NEXTAUTH_SECRET>
AUTH_URL=http://localhost:3001
NEXTAUTH_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:8081
```

**`backend/.env`**
```env
DATABASE_URL=postgres://timetracker:timetracker@localhost:5433/timetracker?sslmode=disable
JWT_SECRET=<same value as AUTH_SECRET>
PORT=8081
```

### 3. Start local Postgres

```bash
docker compose up -d
```

> Uses port **5433** to avoid conflicts with any existing Postgres on 5432.

### 4. Run migrations

```bash
goose -dir migrations postgres "$DATABASE_URL" up
```

### 5. Start the Go API

```bash
cd backend && make run
```

API listens on `http://localhost:8081`. Verify: `curl http://localhost:8081/health`

### 6. Start the Next.js frontend

```bash
cd frontend && npm run dev -- --port 3001
```

App available at `http://localhost:3001`.

---

## Running tests

### Go unit tests (no database required)

```bash
cd backend
go test ./internal/middleware/... ./internal/service/...
```

### Go integration tests (requires Postgres)

```bash
cd backend
DATABASE_URL="postgres://..." JWT_SECRET="test-secret" \
  go test -tags integration ./internal/handler/...
```

### All Go tests with coverage

```bash
cd backend
go test -tags integration -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### Playwright E2E tests

```bash
cd frontend
npx playwright test
```

> Requires `PLAYWRIGHT_BASE_URL` env var pointing at a running instance, or defaults to `http://localhost:3001`.

---

## Deployment

### Frontend — Vercel

1. Import `henrynwajes92/time-tracker` in [vercel.com/new](https://vercel.com/new)
2. Set **Root Directory** → `frontend`
3. Add environment variables:

| Variable | Value |
|---|---|
| `AUTH_SECRET` | Strong random secret |
| `NEXTAUTH_SECRET` | Same as AUTH_SECRET |
| `AUTH_URL` | `https://your-app.vercel.app` |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` |
| `NEXT_PUBLIC_API_URL` | Your Render API URL |

### Go API — Render

1. **New → Web Service** → connect GitHub repo
2. **Root Directory** → `backend`
3. **Runtime** → Docker
4. Add environment variables: `DATABASE_URL`, `JWT_SECRET`, `PORT` (Render sets PORT automatically), `APP_URL` (your Vercel URL)

### Database — Render Postgres

1. **New → PostgreSQL** in your Render project
2. Use the **Internal Database URL** for `DATABASE_URL` on the Go service
3. Run migrations from your local machine using the **External Database URL**:

```bash
goose -dir migrations postgres "<external-url>?sslmode=require" up
```

---

## Environment variable reference

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `AUTH_SECRET` | Yes | NextAuth v5 secret for signing JWTs |
| `NEXTAUTH_SECRET` | Yes | Same as AUTH_SECRET (backwards compat) |
| `AUTH_URL` | Yes | Full URL of the frontend app |
| `NEXTAUTH_URL` | Yes | Same as AUTH_URL (backwards compat) |
| `NEXT_PUBLIC_API_URL` | Yes | Base URL of the Go API |

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Must match AUTH_SECRET on frontend |
| `PORT` | No | Server port (default 8080) |
| `APP_URL` | No | Frontend URL — used in invite links |

---

## Project structure

```
time-tracker/
├── frontend/          # Next.js 16 app
│   └── src/
│       ├── app/
│       │   ├── (app)/     # Authenticated routes
│       │   └── (auth)/    # Login, register, invite
│       ├── lib/           # Auth config, API client
│       └── types/
├── backend/           # Go REST API
│   ├── cmd/server/    # Entry point
│   └── internal/
│       ├── handler/   # HTTP handlers
│       ├── service/   # Business logic
│       ├── repository/# Database access
│       └── middleware/ # JWT auth, CORS
├── migrations/        # Goose SQL migrations
└── .github/workflows/ # CI/CD
```
