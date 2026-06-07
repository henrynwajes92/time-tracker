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
	TaskID          *string    `json:"taskId,omitempty"`
	ProjectID       *string    `json:"projectId,omitempty"`
	ProjectName     string     `json:"projectName,omitempty"`
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

// base SELECT with LEFT JOIN for project name
const entrySelect = `
	SELECT te.id, te.user_id, te.task_id, te.project_id, COALESCE(p.name, '') AS project_name,
	       te.started_at, te.ended_at, te.duration_seconds, COALESCE(te.description, '') AS description, te.created_at
	FROM time_entries te
	LEFT JOIN projects p ON p.id = te.project_id`

func scanEntry(scan func(...any) error) (*TimeEntry, error) {
	e := &TimeEntry{}
	var taskID, projectID sql.NullString
	err := scan(
		&e.ID, &e.UserID, &taskID, &projectID, &e.ProjectName,
		&e.StartedAt, &e.EndedAt, &e.DurationSeconds, &e.Description, &e.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if taskID.Valid {
		e.TaskID = &taskID.String
	}
	if projectID.Valid {
		e.ProjectID = &projectID.String
	}
	return e, nil
}

func (r *TimeEntryRepository) findByID(ctx context.Context, id string) (*TimeEntry, error) {
	return scanEntry(r.db.QueryRowContext(ctx, entrySelect+` WHERE te.id = $1`, id).Scan)
}

func (r *TimeEntryRepository) FindActive(ctx context.Context, userID string) (*TimeEntry, error) {
	e, err := scanEntry(r.db.QueryRowContext(ctx,
		entrySelect+` WHERE te.user_id = $1 AND te.ended_at IS NULL ORDER BY te.started_at DESC LIMIT 1`,
		userID,
	).Scan)
	if err == sql.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	return e, err
}

func (r *TimeEntryRepository) Start(ctx context.Context, userID, projectID, description string) (*TimeEntry, error) {
	var id string
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO time_entries (user_id, project_id, description, started_at)
		 VALUES ($1, $2, $3, NOW()) RETURNING id`,
		userID, projectID, description,
	).Scan(&id)
	if err != nil {
		return nil, err
	}
	return r.findByID(ctx, id)
}

func (r *TimeEntryRepository) Stop(ctx context.Context, id, userID string) (*TimeEntry, error) {
	var entryID string
	err := r.db.QueryRowContext(ctx,
		`UPDATE time_entries
		 SET ended_at = NOW(), duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INT
		 WHERE id = $1 AND user_id = $2 AND ended_at IS NULL
		 RETURNING id`,
		id, userID,
	).Scan(&entryID)
	if err != nil {
		return nil, err
	}
	return r.findByID(ctx, entryID)
}

func (r *TimeEntryRepository) CreateManual(ctx context.Context, userID, projectID, description string, startedAt, endedAt time.Time) (*TimeEntry, error) {
	duration := int(endedAt.Sub(startedAt).Seconds())
	var id string
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO time_entries (user_id, project_id, description, started_at, ended_at, duration_seconds)
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		userID, projectID, description, startedAt, endedAt, duration,
	).Scan(&id)
	if err != nil {
		return nil, err
	}
	return r.findByID(ctx, id)
}

func (r *TimeEntryRepository) Update(ctx context.Context, id, userID, projectID, description string, startedAt, endedAt time.Time) (*TimeEntry, error) {
	duration := int(endedAt.Sub(startedAt).Seconds())
	var entryID string
	err := r.db.QueryRowContext(ctx,
		`UPDATE time_entries
		 SET project_id=$1, task_id=NULL, description=$2, started_at=$3, ended_at=$4, duration_seconds=$5
		 WHERE id=$6 AND user_id=$7 AND ended_at IS NOT NULL
		 RETURNING id`,
		projectID, description, startedAt, endedAt, duration, id, userID,
	).Scan(&entryID)
	if err != nil {
		return nil, err
	}
	return r.findByID(ctx, entryID)
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

func (r *TimeEntryRepository) List(ctx context.Context, userID string, limit int) ([]*TimeEntry, error) {
	rows, err := r.db.QueryContext(ctx,
		entrySelect+` WHERE te.user_id = $1 AND te.ended_at IS NOT NULL ORDER BY te.started_at DESC LIMIT $2`,
		userID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []*TimeEntry
	for rows.Next() {
		e, err := scanEntry(rows.Scan)
		if err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
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
		SELECT u.id, u.name,
		       COALESCE(p.name, '') AS project_name,
		       COALESCE(t.name, '') AS task_name,
		       COALESCE(te.description, '') AS description,
		       te.started_at, COALESCE(te.duration_seconds, 0)
		FROM time_entries te
		JOIN users u ON u.id = te.user_id
		LEFT JOIN projects p ON p.id = te.project_id
		LEFT JOIN tasks t ON t.id = te.task_id
		WHERE u.team_id = $1 AND te.ended_at IS NOT NULL`

	args := []any{teamID}
	n := 2

	if userID != "" {
		base += fmt.Sprintf(" AND te.user_id = $%d", n)
		args = append(args, userID)
		n++
	}
	if projectID != "" {
		base += fmt.Sprintf(" AND te.project_id = $%d", n)
		args = append(args, projectID)
		n++
	}
	if from != "" {
		base += fmt.Sprintf(" AND te.started_at >= $%d", n)
		args = append(args, from)
		n++
	}
	if to != "" {
		base += fmt.Sprintf(" AND te.started_at < $%d", n)
		args = append(args, to)
		n++
	}

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

type DayStats struct {
	Date    string `json:"date"`
	Seconds int    `json:"seconds"`
}

func (r *TimeEntryRepository) DashboardStats(ctx context.Context, userID string) (todaySeconds int, weekSeconds int, weekDays []DayStats, err error) {
	err = r.db.QueryRowContext(ctx,
		`SELECT COALESCE(SUM(duration_seconds), 0) FROM time_entries
		 WHERE user_id = $1 AND started_at >= CURRENT_DATE AND ended_at IS NOT NULL`,
		userID,
	).Scan(&todaySeconds)
	if err != nil {
		return
	}

	err = r.db.QueryRowContext(ctx,
		`SELECT COALESCE(SUM(duration_seconds), 0) FROM time_entries
		 WHERE user_id = $1 AND started_at >= DATE_TRUNC('week', CURRENT_DATE) AND ended_at IS NOT NULL`,
		userID,
	).Scan(&weekSeconds)
	if err != nil {
		return
	}

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
