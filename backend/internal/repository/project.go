package repository

import (
	"context"
	"database/sql"
	"time"
)

type Project struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	TeamID      string     `json:"teamId"`
	ArchivedAt  *time.Time `json:"archivedAt,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
}

type ProjectRepository struct {
	db *sql.DB
}

func NewProjectRepository(db *sql.DB) *ProjectRepository {
	return &ProjectRepository{db: db}
}

func (r *ProjectRepository) List(ctx context.Context, teamID string) ([]*Project, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, name, COALESCE(description,''), team_id, archived_at, created_at
		 FROM projects WHERE team_id = $1 AND archived_at IS NULL ORDER BY created_at`,
		teamID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []*Project
	for rows.Next() {
		p := &Project{}
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.TeamID, &p.ArchivedAt, &p.CreatedAt); err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

func (r *ProjectRepository) FindByID(ctx context.Context, id, teamID string) (*Project, error) {
	p := &Project{}
	err := r.db.QueryRowContext(ctx,
		`SELECT id, name, COALESCE(description,''), team_id, archived_at, created_at
		 FROM projects WHERE id = $1 AND team_id = $2`,
		id, teamID,
	).Scan(&p.ID, &p.Name, &p.Description, &p.TeamID, &p.ArchivedAt, &p.CreatedAt)
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (r *ProjectRepository) Create(ctx context.Context, name, description, teamID string) (*Project, error) {
	p := &Project{}
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO projects (name, description, team_id)
		 VALUES ($1, $2, $3)
		 RETURNING id, name, COALESCE(description,''), team_id, archived_at, created_at`,
		name, description, teamID,
	).Scan(&p.ID, &p.Name, &p.Description, &p.TeamID, &p.ArchivedAt, &p.CreatedAt)
	return p, err
}

func (r *ProjectRepository) Update(ctx context.Context, id, teamID, name, description string) error {
	result, err := r.db.ExecContext(ctx,
		`UPDATE projects SET name = $1, description = $2 WHERE id = $3 AND team_id = $4`,
		name, description, id, teamID,
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

func (r *ProjectRepository) Archive(ctx context.Context, id, teamID string) error {
	result, err := r.db.ExecContext(ctx,
		`UPDATE projects SET archived_at = NOW() WHERE id = $1 AND team_id = $2 AND archived_at IS NULL`,
		id, teamID,
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
