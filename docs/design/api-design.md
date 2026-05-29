# API Design — Design Document

**Status:** Draft  
**Author:** Henry Nwaokonko  
**Date:** 2026-05-29  

---

## Overview

REST API design for the Time Tracker application. All endpoints are implemented as Next.js API routes under `/api/**`. This document defines every endpoint, its request/response shape, and authentication requirements.

## Goals

- Define a complete, consistent REST API covering all application features
- Enforce role-based access control server-side on every request
- Use a standard error response format across all endpoints

## Non-Goals

- GraphQL or tRPC (plain REST is sufficient for MVP)
- API versioning (not needed at this stage)
- Public/third-party API access (internal use only)

---

## Design

### Conventions

- All request and response bodies are JSON (`Content-Type: application/json`)
- Authentication is via session cookie (managed by NextAuth.js)
- Dates are ISO 8601 strings (e.g. `2026-05-29T09:00:00.000Z`)
- All list responses return an array directly (no envelope for MVP)

### Standard Error Response

```json
{
  "error": "Human-readable error message"
}
```

| HTTP Status | When used |
|---|---|
| 400 | Invalid request body or parameters |
| 401 | No valid session (not logged in) |
| 403 | Authenticated but not authorised (wrong role) |
| 404 | Resource not found |
| 409 | Conflict (e.g. email already in use) |
| 500 | Unexpected server error |

### Authentication Level Key

- **Public** — No session required
- **Auth** — Valid session required (any role)
- **Admin** — Valid session + Admin role required

---

## Endpoints

### Auth — `/api/auth/**`

Managed by NextAuth.js. Custom endpoints:

#### `POST /api/auth/register`
**Auth:** Public

Request:
```json
{ "name": "Jane Smith", "email": "jane@example.com", "password": "secret123", "teamName": "Acme Co" }
```
Response `201`:
```json
{ "id": "cuid", "name": "Jane Smith", "email": "jane@example.com", "role": "ADMIN" }
```

#### `POST /api/auth/register/invite`
**Auth:** Public (invite token required)

Request:
```json
{ "name": "Bob Jones", "email": "bob@example.com", "password": "secret123", "token": "invite-token-here" }
```
Response `201`:
```json
{ "id": "cuid", "name": "Bob Jones", "email": "bob@example.com", "role": "MEMBER" }
```
Errors: `400` if token is expired or already used, `409` if email already registered.

#### `POST /api/auth/invite`
**Auth:** Admin

Request:
```json
{ "email": "newperson@example.com" }
```
Response `200`:
```json
{ "message": "Invite sent to newperson@example.com" }
```

#### `POST /api/auth/reset-password/request`
**Auth:** Public

Request: `{ "email": "jane@example.com" }`  
Response `200`: `{ "message": "Reset email sent if account exists" }`

#### `POST /api/auth/reset-password/confirm`
**Auth:** Public

Request: `{ "token": "reset-token", "password": "newpassword123" }`  
Response `200`: `{ "message": "Password updated" }`

---

### Users — `/api/users`

#### `GET /api/users`
**Auth:** Admin — List all users in the team.

Response `200`:
```json
[
  { "id": "cuid", "name": "Jane Smith", "email": "jane@example.com", "role": "ADMIN", "createdAt": "..." }
]
```

#### `PATCH /api/users/[id]`
**Auth:** Admin (to change role) or the user themselves (to update name/email/password)

Request (admin changing role): `{ "role": "ADMIN" }`  
Request (self-update): `{ "name": "Jane S.", "email": "jane2@example.com", "password": "newpass" }`  
Response `200`: Updated user object.

#### `DELETE /api/users/[id]`
**Auth:** Admin — Remove a member from the team. Their time entries are preserved.

Response `200`: `{ "message": "User removed" }`

---

### Projects — `/api/projects`

#### `GET /api/projects`
**Auth:** Auth — List all active (non-archived) projects for the team.

Response `200`:
```json
[
  { "id": "cuid", "name": "Website Redesign", "description": "...", "createdAt": "..." }
]
```

#### `POST /api/projects`
**Auth:** Admin

Request: `{ "name": "Website Redesign", "description": "Optional description" }`  
Response `201`: Created project object.

#### `GET /api/projects/[id]`
**Auth:** Auth — Get a single project with its active tasks.

Response `200`:
```json
{
  "id": "cuid", "name": "Website Redesign", "description": "...",
  "tasks": [{ "id": "cuid", "name": "Design homepage", "createdAt": "..." }]
}
```

#### `PATCH /api/projects/[id]`
**Auth:** Admin

Request: `{ "name": "New Name" }` or `{ "archived": true }`  
Response `200`: Updated project object.

#### `DELETE /api/projects/[id]`
**Auth:** Admin — Hard delete only if the project has no time entries; otherwise archive it.

Response `200`: `{ "message": "Project deleted" }`

---

### Tasks — `/api/projects/[projectId]/tasks` and `/api/tasks/[id]`

#### `GET /api/projects/[projectId]/tasks`
**Auth:** Auth — List active tasks for a project.

Response `200`: `[{ "id": "cuid", "name": "Design homepage", "createdAt": "..." }]`

#### `POST /api/projects/[projectId]/tasks`
**Auth:** Admin

Request: `{ "name": "Design homepage" }`  
Response `201`: Created task object.

#### `PATCH /api/tasks/[id]`
**Auth:** Admin

Request: `{ "name": "New name" }` or `{ "archived": true }`  
Response `200`: Updated task object.

---

### Time Entries — `/api/time-entries`

#### `GET /api/time-entries`
**Auth:** Auth — List the authenticated user's time entries.

Query params: `?from=2026-05-01&to=2026-05-31&taskId=cuid`  
Response `200`:
```json
[
  {
    "id": "cuid", "startedAt": "...", "endedAt": "...", "durationSeconds": 3600,
    "description": "Working on homepage", "task": { "id": "cuid", "name": "Design homepage",
    "project": { "id": "cuid", "name": "Website Redesign" } }
  }
]
```

#### `POST /api/time-entries`
**Auth:** Auth — Create a new time entry (timer start or manual entry).

Timer start: `{ "taskId": "cuid", "startedAt": "2026-05-29T09:00:00.000Z" }`  
Manual entry: `{ "taskId": "cuid", "startedAt": "...", "endedAt": "...", "durationSeconds": 3600, "description": "..." }`  
Response `201`: Created time entry object.  
Error `409` if user already has an active timer.

#### `GET /api/time-entries/active`
**Auth:** Auth — Get the currently running timer for the user, if any.

Response `200`: Time entry object or `null`.

#### `POST /api/time-entries/[id]/stop`
**Auth:** Auth (own entries only) — Stop the active timer.

Request: `{ "endedAt": "2026-05-29T10:00:00.000Z" }`  
Response `200`: Updated time entry with `endedAt` and `durationSeconds` set.

#### `PATCH /api/time-entries/[id]`
**Auth:** Auth (own entries only)

Request: `{ "description": "Updated description", "durationSeconds": 3700 }`  
Response `200`: Updated time entry object.

#### `DELETE /api/time-entries/[id]`
**Auth:** Auth (own entries only)

Response `200`: `{ "message": "Time entry deleted" }`

---

### Reports — `/api/reports`

#### `GET /api/reports`
**Auth:** Auth (members see own data only; admins can filter by any user)

Query params:
- `from` (required): ISO date string
- `to` (required): ISO date string
- `userId` (optional, admin only): filter by user
- `projectId` (optional): filter by project
- `format` (optional): `json` (default) or `csv`

Response `200` (JSON):
```json
[
  {
    "userId": "cuid", "userName": "Jane Smith",
    "projectId": "cuid", "projectName": "Website Redesign",
    "totalSeconds": 18000, "totalHours": 5.0
  }
]
```

Response `200` (CSV — `Content-Type: text/csv`, `Content-Disposition: attachment`):
```
User,Project,Total Hours
Jane Smith,Website Redesign,5.00
Bob Jones,Website Redesign,3.50
```

---

## Open Questions

- Should `PATCH /api/users/[id]` be split into separate endpoints for role changes vs profile updates? (Can unify for MVP with different allowed fields per role.)
- Do we need pagination on `GET /api/time-entries`? (Add cursor-based pagination if a user exceeds 500 entries — defer for now.)
