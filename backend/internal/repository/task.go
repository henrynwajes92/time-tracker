package repository

import (
	"context"
	"database/sql"
	"time"
)

type Task struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	ProjectID  string     `json:"projectId"`
	ArchivedAt *time.Time `json:"archivedAt,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
}

type TaskRepository struct {
	db *sql.DB
}

func NewTaskRepository(db *sql.DB) *TaskRepository {
	return &TaskRepository{db: db}
}

func (r *TaskRepository) ListByProject(ctx context.Context, projectID string) ([]*Task, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, name, project_id, archived_at, created_at
		 FROM tasks WHERE project_id = $1 AND archived_at IS NULL ORDER BY created_at`,
		projectID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*Task
	for rows.Next() {
		t := &Task{}
		if err := rows.Scan(&t.ID, &t.Name, &t.ProjectID, &t.ArchivedAt, &t.CreatedAt); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}

func (r *TaskRepository) Create(ctx context.Context, name, projectID string) (*Task, error) {
	t := &Task{}
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO tasks (name, project_id) VALUES ($1, $2)
		 RETURNING id, name, project_id, archived_at, created_at`,
		name, projectID,
	).Scan(&t.ID, &t.Name, &t.ProjectID, &t.ArchivedAt, &t.CreatedAt)
	return t, err
}

func (r *TaskRepository) Update(ctx context.Context, id, name string) error {
	result, err := r.db.ExecContext(ctx,
		`UPDATE tasks SET name = $1 WHERE id = $2 AND archived_at IS NULL`,
		name, id,
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

func (r *TaskRepository) Archive(ctx context.Context, id string) error {
	result, err := r.db.ExecContext(ctx,
		`UPDATE tasks SET archived_at = NOW() WHERE id = $1 AND archived_at IS NULL`,
		id,
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
