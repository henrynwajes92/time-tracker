package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type TimeEntry struct {
	ID              string     `json:"id"`
	UserID          string     `json:"userId"`
	TaskID          string     `json:"taskId"`
	StartedAt       time.Time  `json:"startedAt"`
	EndedAt         *time.Time `json:"endedAt,omitempty"`
	DurationSeconds *int       `json:"durationSeconds,omitempty"`
	Description     string     `json:"description"`
	CreatedAt       time.Time  `json:"createdAt"`
}

type TimeEntryRepository struct {
	db *sql.DB
}

func NewTimeEntryRepository(db *sql.DB) *TimeEntryRepository {
	return &TimeEntryRepository{db: db}
}

func (r *TimeEntryRepository) FindActive(ctx context.Context, userID string) (*TimeEntry, error) {
	e := &TimeEntry{}
	err := r.db.QueryRowContext(ctx,
		`SELECT id, user_id, task_id, started_at, ended_at, duration_seconds, COALESCE(description,''), created_at
		 FROM time_entries WHERE user_id = $1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1`,
		userID,
	).Scan(&e.ID, &e.UserID, &e.TaskID, &e.StartedAt, &e.EndedAt, &e.DurationSeconds, &e.Description, &e.CreatedAt)
	if err != nil {
		return nil, err
	}
	return e, nil
}

func (r *TimeEntryRepository) Start(ctx context.Context, userID, taskID, description string) (*TimeEntry, error) {
	e := &TimeEntry{}
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO time_entries (user_id, task_id, description, started_at)
		 VALUES ($1, $2, $3, NOW())
		 RETURNING id, user_id, task_id, started_at, ended_at, duration_seconds, COALESCE(description,''), created_at`,
		userID, taskID, description,
	).Scan(&e.ID, &e.UserID, &e.TaskID, &e.StartedAt, &e.EndedAt, &e.DurationSeconds, &e.Description, &e.CreatedAt)
	return e, err
}

func (r *TimeEntryRepository) Stop(ctx context.Context, id, userID string) (*TimeEntry, error) {
	e := &TimeEntry{}
	err := r.db.QueryRowContext(ctx,
		`UPDATE time_entries
		 SET ended_at = NOW(),
		     duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INT
		 WHERE id = $1 AND user_id = $2 AND ended_at IS NULL
		 RETURNING id, user_id, task_id, started_at, ended_at, duration_seconds, COALESCE(description,''), created_at`,
		id, userID,
	).Scan(&e.ID, &e.UserID, &e.TaskID, &e.StartedAt, &e.EndedAt, &e.DurationSeconds, &e.Description, &e.CreatedAt)
	if err != nil {
		return nil, err
	}
	return e, nil
}

func (r *TimeEntryRepository) CreateManual(ctx context.Context, userID, taskID, description string, startedAt, endedAt time.Time) (*TimeEntry, error) {
	duration := int(endedAt.Sub(startedAt).Seconds())
	e := &TimeEntry{}
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO time_entries (user_id, task_id, description, started_at, ended_at, duration_seconds)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, user_id, task_id, started_at, ended_at, duration_seconds, COALESCE(description,''), created_at`,
		userID, taskID, description, startedAt, endedAt, duration,
	).Scan(&e.ID, &e.UserID, &e.TaskID, &e.StartedAt, &e.EndedAt, &e.DurationSeconds, &e.Description, &e.CreatedAt)
	return e, err
}

type ReportEntry struct {
	UserID          string    `json:"userId"`
	UserName        string    `json:"userName"`
	ProjectName     string    `json:"projectName"`
	TaskName        string    `json:"taskName"`
	Description     string    `json:"description"`
	StartedAt       time.Time `json:"startedAt"`
	DurationSeconds int       `json:"durationSeconds"`
}

func (r *TimeEntryRepository) Report(ctx context.Context, teamID, userID, projectID, from, to string) ([]*ReportEntry, error) {
	base := `
		SELECT u.id, u.name, p.name, t.name, COALESCE(te.description,''), te.started_at, COALESCE(te.duration_seconds,0)
		FROM time_entries te
		JOIN users u ON u.id = te.user_id
		JOIN tasks t ON t.id = te.task_id
		JOIN projects p ON p.id = t.project_id
		WHERE u.team_id = $1 AND te.ended_at IS NOT NULL`

	args := []any{teamID}
	n := 2

	addFilter := func(clause string, val string) {
		base += fmt.Sprintf(" AND %s = $%d", clause, n)
		args = append(args, val)
		n++
	}
	addRange := func(clause string, val string) {
		base += fmt.Sprintf(" AND %s >= $%d", clause, n)
		args = append(args, val)
		n++
	}
	addRangeEnd := func(clause string, val string) {
		base += fmt.Sprintf(" AND %s < $%d", clause, n)
		args = append(args, val)
		n++
	}

	if userID != "" { addFilter("te.user_id", userID) }
	if projectID != "" { addFilter("p.id", projectID) }
	if from != "" { addRange("te.started_at", from) }
	if to != "" { addRangeEnd("te.started_at", to) }

	base += " ORDER BY te.started_at DESC"

	rows, err := r.db.QueryContext(ctx, base, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []*ReportEntry
	for rows.Next() {
		e := &ReportEntry{}
		if err := rows.Scan(&e.UserID, &e.UserName, &e.ProjectName, &e.TaskName, &e.Description, &e.StartedAt, &e.DurationSeconds); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

func (r *TimeEntryRepository) Update(ctx context.Context, id, userID, taskID, description string, startedAt, endedAt time.Time) (*TimeEntry, error) {
	duration := int(endedAt.Sub(startedAt).Seconds())
	e := &TimeEntry{}
	err := r.db.QueryRowContext(ctx,
		`UPDATE time_entries
		 SET task_id=$1, description=$2, started_at=$3, ended_at=$4, duration_seconds=$5
		 WHERE id=$6 AND user_id=$7 AND ended_at IS NOT NULL
		 RETURNING id, user_id, task_id, started_at, ended_at, duration_seconds, COALESCE(description,''), created_at`,
		taskID, description, startedAt, endedAt, duration, id, userID,
	).Scan(&e.ID, &e.UserID, &e.TaskID, &e.StartedAt, &e.EndedAt, &e.DurationSeconds, &e.Description, &e.CreatedAt)
	if err != nil {
		return nil, err
	}
	return e, nil
}

func (r *TimeEntryRepository) Delete(ctx context.Context, id, userID string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM time_entries WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

type DayStats struct {
	Date    string `json:"date"`
	Seconds int    `json:"seconds"`
}

func (r *TimeEntryRepository) DashboardStats(ctx context.Context, userID string) (todaySeconds int, weekSeconds int, weekDays []DayStats, err error) {
	// Today total
	err = r.db.QueryRowContext(ctx,
		`SELECT COALESCE(SUM(duration_seconds), 0) FROM time_entries
		 WHERE user_id = $1 AND started_at >= CURRENT_DATE AND ended_at IS NOT NULL`,
		userID,
	).Scan(&todaySeconds)
	if err != nil {
		return
	}

	// Week total
	err = r.db.QueryRowContext(ctx,
		`SELECT COALESCE(SUM(duration_seconds), 0) FROM time_entries
		 WHERE user_id = $1 AND started_at >= DATE_TRUNC('week', CURRENT_DATE) AND ended_at IS NOT NULL`,
		userID,
	).Scan(&weekSeconds)
	if err != nil {
		return
	}

	// Per-day breakdown this week
	rows, err := r.db.QueryContext(ctx,
		`SELECT TO_CHAR(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
		        COALESCE(SUM(duration_seconds), 0)
		 FROM time_entries
		 WHERE user_id = $1 AND started_at >= DATE_TRUNC('week', CURRENT_DATE) AND ended_at IS NOT NULL
		 GROUP BY day ORDER BY day`,
		userID,
	)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var d DayStats
		if scanErr := rows.Scan(&d.Date, &d.Seconds); scanErr != nil {
			err = scanErr
			return
		}
		weekDays = append(weekDays, d)
	}
	err = rows.Err()
	return
}

func (r *TimeEntryRepository) List(ctx context.Context, userID string, limit int) ([]*TimeEntry, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, user_id, task_id, started_at, ended_at, duration_seconds, COALESCE(description,''), created_at
		 FROM time_entries WHERE user_id = $1 AND ended_at IS NOT NULL
		 ORDER BY started_at DESC LIMIT $2`,
		userID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []*TimeEntry
	for rows.Next() {
		e := &TimeEntry{}
		if err := rows.Scan(&e.ID, &e.UserID, &e.TaskID, &e.StartedAt, &e.EndedAt, &e.DurationSeconds, &e.Description, &e.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}
