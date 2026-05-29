# Time Tracker — Requirements

**Status:** Draft  
**Author:** Henry Nwaokonko  
**Date:** 2026-05-29  

---

## Summary

A web-based team time tracking application that allows multiple users to log time against projects and tasks. Team members can track time using a live start/stop timer or by logging past time manually. Admins can manage the team, create projects and tasks, and view reports across all members. Members can view and export their own time data.

---

## User Stories

### Admin
- As an admin, I want to create and archive projects so that the team has a structured list of work to log time against.
- As an admin, I want to create and archive tasks within a project so that time entries are categorised at a granular level.
- As an admin, I want to invite team members via email so that they can join the workspace and start logging time.
- As an admin, I want to assign and change member roles so that I control who has administrative access.
- As an admin, I want to remove a member from the team so that former employees can no longer access the workspace.
- As an admin, I want to view time reports for all team members so that I can track team productivity and project costs.
- As an admin, I want to filter reports by user, project, and date range so that I can answer specific questions about time usage.
- As an admin, I want to export reports to CSV so that I can share or process time data in other tools.

### Team Member
- As a member, I want to start a live timer against a project and task so that my time is captured automatically while I work.
- As a member, I want to stop the running timer so that my time entry is saved when I finish a task.
- As a member, I want to log a past time entry manually so that I can record time I forgot to track with the timer.
- As a member, I want to edit or delete my own time entries so that I can correct mistakes.
- As a member, I want to see a dashboard summary of my hours today and this week so that I can monitor my own output.
- As a member, I want to view and filter my own time entry history so that I can review what I worked on.
- As a member, I want to export my own time data to CSV so that I can keep personal records.
- As a member, I want to update my account name, email, and password so that my profile stays accurate.

---

## Functional Requirements

### Authentication & Onboarding
1. Users can register with an email address and password.
2. A new team workspace is created automatically when the first user registers.
3. Admins can send email invitations to new members. Invitation links are single-use and expire after 7 days.
4. Invited users register via the invite link and are automatically added to the correct team.
5. Users can log in with their email and password and receive a persistent session.
6. Users can reset their password via a reset link sent to their email.

### Roles & Permissions
7. Two roles exist: **Admin** and **Member**.
8. Admins can: create/archive projects and tasks, invite/remove members, change member roles, and view all reports.
9. Members can: log and edit their own time entries, view active projects and tasks, and view/export their own reports only.
10. When a member is removed from the team their past time entries are preserved and remain visible to admins in reports.

### Projects & Tasks
11. Admins can create, rename, and archive projects.
12. Archived projects are hidden from the active list but their data is preserved.
13. Admins can create, rename, and archive tasks within a project.
14. Members can view all active projects and their tasks.

### Time Logging — Live Timer
15. A user can start a timer by selecting a project and task.
16. Only one timer can run at a time per user. Starting a new timer prompts the user to stop the current one.
17. The timer displays elapsed time in HH:MM:SS, updating every second.
18. The active timer persists across page refreshes (state stored server-side).
19. Stopping the timer saves the entry with the correct start time, end time, and duration.

### Time Logging — Manual Entry
20. A user can log a past time entry by providing: date, project, task, duration (HH:MM), and an optional description.
21. A user can edit any of their own time entries.
22. A user can delete any of their own time entries, with a confirmation prompt.
23. Time entries are displayed in reverse-chronological order in the time entry list.

### Dashboard
24. The dashboard shows the user's total hours logged today, with a per-project breakdown.
25. The dashboard shows the user's total hours for the current week with a daily summary.
26. If a timer is running, it is displayed prominently on the dashboard with the elapsed time updating live.
27. The dashboard shows the 5 most recent time entries with quick access to edit them.

### Reports
28. Users can filter time entries by date range (required), project (optional), and user (admin only).
29. The report displays a summary table of total hours grouped by project and user.
30. Reports can be exported as a CSV file.
31. Members can only access reports for their own time data; admins can access all members' data.

---

## Non-Functional Requirements

- **Performance:** Initial page load under 2 seconds. API responses at p95 under 300ms. Dashboard must load within 1 second for a user with 100+ time entries.
- **Security:** All traffic over HTTPS. Passwords stored as bcrypt hashes. Sessions expire after 30 days of inactivity. Role-based access enforced server-side on every API request.
- **Browser Support:** Latest 2 versions of Chrome, Firefox, Safari, and Edge.
- **Data Retention:** Time entries are retained indefinitely unless manually deleted by the user. No automatic purging for MVP.
- **Scalability:** MVP target is up to 50 concurrent users and up to 10,000 time entries per team.
- **Accessibility:** WCAG 2.1 AA compliance for core flows (login, timer, manual entry, dashboard).

---

## Data Model

| Entity | Key Fields |
|---|---|
| User | id, name, email, passwordHash, role (admin\|member), teamId, createdAt |
| Team | id, name, createdAt |
| Project | id, name, description, teamId, archivedAt, createdAt |
| Task | id, name, projectId, archivedAt, createdAt |
| TimeEntry | id, userId, taskId, startedAt, endedAt, durationSeconds, description, createdAt |
| InviteToken | id, email, teamId, token, expiresAt, usedAt |

**Relationships:**
- A Team has many Users, Projects
- A Project has many Tasks
- A TimeEntry belongs to one User and one Task
- An InviteToken belongs to one Team

**Business Rules:**
- A time entry cannot have `endedAt` before `startedAt`
- A user may have at most one time entry where `endedAt` is null (the active timer)
- Archiving a project does not archive its tasks or delete its time entries

---

## Acceptance Criteria

### Authentication
- [ ] User can register, log in, and log out successfully
- [ ] Invite link allows a new user to register and join the correct team
- [ ] Expired or already-used invite links are rejected
- [ ] Password reset email is sent and the reset flow works end-to-end

### Roles & Permissions
- [ ] Member cannot access admin-only pages or API endpoints (returns 403)
- [ ] Admin can change a member's role and the change takes effect immediately
- [ ] Removed member's time entries remain visible in admin reports

### Projects & Tasks
- [ ] Admin can create, rename, and archive a project
- [ ] Archived project is hidden from the active list
- [ ] Admin can create, rename, and archive a task within a project

### Time Logging
- [ ] Timer starts, displays elapsed time live, and saves correctly on stop
- [ ] Starting a second timer prompts the user and stops the first
- [ ] Active timer survives a page refresh
- [ ] Manual entry is saved with correct date, project, task, duration, and description
- [ ] User can edit and delete their own entries

### Dashboard
- [ ] Today's total hours and per-project breakdown are correct
- [ ] Running timer is shown live on the dashboard
- [ ] 5 most recent entries are listed with edit access

### Reports
- [ ] Report filters by date range, project, and user (admin) correctly
- [ ] CSV export downloads a valid, correctly formatted file
- [ ] Member cannot see other users' data in reports
