# UI/UX Wireframes — Design Document

**Status:** Draft  
**Author:** Henry Nwaokonko  
**Date:** 2026-05-29  

---

## Overview

Low-fidelity wireframes for all key screens in the Time Tracker application. These define layout, navigation, and content structure — not visual design or colour.

## Goals

- Define the layout and content of every major screen before implementation begins
- Document the navigation flow between screens
- Provide enough detail for a developer to build the UI without ambiguity

## Non-Goals

- High-fidelity design or branding (handled separately in Figma if needed)
- Mobile layout (web-only for MVP)
- Micro-interactions or animation specifications

---

## Navigation Structure

```
/login                        Public
/register                     Public
/register/invite              Public (invite token required)
/auth/reset-password          Public

/dashboard                    Protected (all roles)
/timer                        Protected (all roles)
/time-entries                 Protected (all roles)
/projects                     Protected (all roles)
/projects/[id]                Protected (all roles)
/reports                      Protected (all roles)
/settings                     Protected (all roles)
/settings/team                Protected (Admin only)
```

**Global navigation (sidebar — visible on all protected pages):**

```
┌─────────────────┐
│  ⏱ Time Tracker │
├─────────────────┤
│ 📊 Dashboard    │
│ ⏱  Timer        │
│ 📋 Time Entries │
│ 📁 Projects     │
│ 📈 Reports      │
├─────────────────┤
│ ⚙  Settings     │
│ 👋 Log out      │
└─────────────────┘
```

---

## Screen Wireframes

### 1. Login `/login`

```
┌──────────────────────────────────────────┐
│                                          │
│           ⏱ Time Tracker                │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  Email                             │  │
│  │  [email@example.com              ] │  │
│  │                                    │  │
│  │  Password                          │  │
│  │  [••••••••••••••••••••••••••••••] │  │
│  │                                    │  │
│  │  [        Sign In        ]         │  │
│  │                                    │  │
│  │  Forgot password?                  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Don't have an account? Register         │
│                                          │
└──────────────────────────────────────────┘
```

---

### 2. Register `/register`

```
┌──────────────────────────────────────────┐
│           ⏱ Time Tracker                │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  Full Name                         │  │
│  │  [Jane Smith                     ] │  │
│  │                                    │  │
│  │  Team Name                         │  │
│  │  [Acme Co                        ] │  │
│  │                                    │  │
│  │  Email                             │  │
│  │  [jane@example.com               ] │  │
│  │                                    │  │
│  │  Password                          │  │
│  │  [••••••••••••••••••••••••••••••] │  │
│  │                                    │  │
│  │  [       Create Account      ]     │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Already have an account? Sign in        │
└──────────────────────────────────────────┘
```

*(Invite registration is the same form minus "Team Name" — the team is inferred from the token.)*

---

### 3. Dashboard `/dashboard`

```
┌──────────┬───────────────────────────────────────────────┐
│ Sidebar  │  Dashboard                                    │
│          │                                               │
│ Dashboard│  ┌─────────────────┐  ┌──────────────────┐   │
│ Timer    │  │  Today          │  │  This Week        │   │
│ Entries  │  │  3h 45m         │  │  18h 20m          │   │
│ Projects │  │  ─────────────  │  │  Mon ████ 4h      │   │
│ Reports  │  │  Website  2h    │  │  Tue ███  3h      │   │
│ Settings │  │  Admin    1h45m │  │  Wed ████ 4h      │   │
│          │  └─────────────────┘  │  Thu ██   2h      │   │
│          │                       │  Fri ███  3h 20m  │   │
│          │  ┌──────────────────────────────────────┐ │   │
│          │  │  ▶ Active Timer                      │ │   │
│          │  │  Website Redesign › Design homepage  │ │   │
│          │  │  01:23:45  [  Stop Timer  ]           │ │   │
│          │  └──────────────────────────────────────┘ │   │
│          │                                            │   │
│          │  Recent Entries                            │   │
│          │  ┌──────────────────────────────────────┐ │   │
│          │  │ Design homepage · 2h 00m · Today  ✏  │ │   │
│          │  │ Team meeting    · 0h 45m · Today  ✏  │ │   │
│          │  │ Code review     · 1h 30m · Yesterday ✏│ │   │
│          │  └──────────────────────────────────────┘ │   │
└──────────┴───────────────────────────────────────────────┘
```

---

### 4. Timer `/timer`

```
┌──────────┬───────────────────────────────────────────────┐
│ Sidebar  │  Track Time                                   │
│          │                                               │
│          │  ┌──────────────────────────────────────────┐ │
│          │  │  Project                                  │ │
│          │  │  [ Website Redesign              ▼ ]     │ │
│          │  │                                          │ │
│          │  │  Task                                    │ │
│          │  │  [ Design homepage               ▼ ]     │ │
│          │  │                                          │ │
│          │  │  Description (optional)                  │ │
│          │  │  [ Working on hero section...    ]       │ │
│          │  │                                          │ │
│          │  │         01 : 23 : 45                    │ │
│          │  │                                          │ │
│          │  │  [         Stop Timer          ]         │ │
│          │  └──────────────────────────────────────────┘ │
│          │                                               │
│          │  ── Or log time manually ──                  │
│          │                                               │
│          │  Date       [ 2026-05-29      ]               │
│          │  Project    [ Website Redesign ▼]             │
│          │  Task       [ Design homepage  ▼]             │
│          │  Duration   [ 02 ] h  [ 00 ] m               │
│          │  Description[ Optional...      ]              │
│          │  [ Save Entry ]                               │
└──────────┴───────────────────────────────────────────────┘
```

---

### 5. Time Entry List `/time-entries`

```
┌──────────┬───────────────────────────────────────────────┐
│ Sidebar  │  Time Entries                                 │
│          │                                               │
│          │  [ This Week ▼ ]  [ All Projects ▼ ]  Search │
│          │                                               │
│          │  Monday, 29 May 2026                          │
│          │  ┌──────────────────────────────────────────┐ │
│          │  │ Design homepage                          │ │
│          │  │ Website Redesign  2h 00m  09:00–11:00  ✏ 🗑│
│          │  ├──────────────────────────────────────────┤ │
│          │  │ Team standup                             │ │
│          │  │ Admin             0h 15m  08:45–09:00  ✏ 🗑│
│          │  └──────────────────────────────────────────┘ │
│          │  Daily total: 2h 15m                          │
│          │                                               │
│          │  Sunday, 28 May 2026                          │
│          │  ┌──────────────────────────────────────────┐ │
│          │  │ Code review                              │ │
│          │  │ Website Redesign  1h 30m  14:00–15:30  ✏ 🗑│
│          │  └──────────────────────────────────────────┘ │
│          │  Daily total: 1h 30m                          │
│          │                                               │
│          │  Week total: 18h 20m                          │
└──────────┴───────────────────────────────────────────────┘
```

*(Clicking ✏ expands the row into an inline edit form.)*

---

### 6. Projects & Tasks `/projects` and `/projects/[id]`

**Project List:**
```
┌──────────┬───────────────────────────────────────────────┐
│ Sidebar  │  Projects              [ + New Project ]      │
│          │                                               │
│          │  ┌──────────────────────────────────────────┐ │
│          │  │ 📁 Website Redesign           →  8 tasks │ │
│          │  ├──────────────────────────────────────────┤ │
│          │  │ 📁 Mobile App                →  3 tasks  │ │
│          │  ├──────────────────────────────────────────┤ │
│          │  │ 📁 Admin Work               →  2 tasks  │ │
│          │  └──────────────────────────────────────────┘ │
│          │                                               │
│          │  [ Show archived projects ]                   │
└──────────┴───────────────────────────────────────────────┘
```

**Project Detail:**
```
┌──────────┬───────────────────────────────────────────────┐
│ Sidebar  │  ← Projects                                  │
│          │  📁 Website Redesign        [ ⋯ Archive ]    │
│          │                                               │
│          │  Tasks                      [ + New Task ]   │
│          │  ┌──────────────────────────────────────────┐ │
│          │  │ Design homepage                    ⋯     │ │
│          │  ├──────────────────────────────────────────┤ │
│          │  │ Build navigation component         ⋯     │ │
│          │  ├──────────────────────────────────────────┤ │
│          │  │ Write copy                         ⋯     │ │
│          │  └──────────────────────────────────────────┘ │
│          │  (⋯ opens rename / archive options)           │
└──────────┴───────────────────────────────────────────────┘
```

---

### 7. Reports `/reports`

```
┌──────────┬───────────────────────────────────────────────┐
│ Sidebar  │  Reports                                      │
│          │                                               │
│          │  From [ 2026-05-01 ]  To [ 2026-05-31 ]      │
│          │  Project [ All Projects ▼ ]                  │
│          │  User    [ All Members  ▼ ] (admin only)     │
│          │  [ Run Report ]               [ Export CSV ] │
│          │                                               │
│          │  ┌──────────────────────────────────────────┐ │
│          │  │ User          Project          Hours      │ │
│          │  ├──────────────────────────────────────────┤ │
│          │  │ Jane Smith    Website Redesign   24h 00m  │ │
│          │  │ Jane Smith    Admin Work          6h 15m  │ │
│          │  │ Bob Jones     Website Redesign   18h 30m  │ │
│          │  │ Bob Jones     Mobile App          9h 00m  │ │
│          │  ├──────────────────────────────────────────┤ │
│          │  │ Total                            57h 45m  │ │
│          │  └──────────────────────────────────────────┘ │
└──────────┴───────────────────────────────────────────────┘
```

---

### 8. Team Management `/settings/team` (Admin only)

```
┌──────────┬───────────────────────────────────────────────┐
│ Sidebar  │  Settings › Team                              │
│          │                                               │
│          │  Invite Member                                │
│          │  ┌──────────────────────────────────────────┐ │
│          │  │ Email  [ newperson@example.com    ]       │ │
│          │  │ [ Send Invite ]                           │ │
│          │  └──────────────────────────────────────────┘ │
│          │                                               │
│          │  Team Members                                 │
│          │  ┌──────────────────────────────────────────┐ │
│          │  │ Jane Smith   jane@…   Admin    [ ⋯ ]     │ │
│          │  ├──────────────────────────────────────────┤ │
│          │  │ Bob Jones    bob@…    Member   [ ⋯ ]     │ │
│          │  ├──────────────────────────────────────────┤ │
│          │  │ Alice Lee    alice@…  Member   [ ⋯ ]     │ │
│          │  └──────────────────────────────────────────┘ │
│          │  (⋯ opens: Make Admin / Make Member / Remove) │
└──────────┴───────────────────────────────────────────────┘
```

---

## Navigation Flow

```
/login ──────────────────────────────────────▶ /dashboard
/register ───────────────────────────────────▶ /dashboard
/register/invite ────────────────────────────▶ /dashboard

/dashboard ──▶ /timer (Start Timer button)
/dashboard ──▶ /time-entries (Recent entries link)

/timer ──────▶ /dashboard (after stopping timer)

/time-entries ──▶ inline edit (no page change)

/projects ───▶ /projects/[id] (click project)

/settings ───▶ /settings/team (Admin only)
```

## Open Questions

- Should Timer and Time Entries be combined into one page, or kept separate? (Kept separate for clarity — the timer is a distinct "working now" mode.)
- Should the sidebar collapse on smaller screens? (Yes — add a hamburger toggle, deferred to post-MVP.)
