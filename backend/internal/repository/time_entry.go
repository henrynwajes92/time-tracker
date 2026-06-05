package repository

import (
	"context"
	"database/sql"
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
		`INSERT INTO time_entries (user_id, task_id, description)
		 VALUES ($1, $2, $3)
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
