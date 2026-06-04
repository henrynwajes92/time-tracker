package repository

import (
	"context"
	"database/sql"
	"time"
)

type User struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	TeamID       string    `json:"teamId"`
	CreatedAt    time.Time `json:"createdAt"`
}

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*User, error) {
	u := &User{}
	err := r.db.QueryRowContext(ctx,
		`SELECT id, name, email, password_hash, role, team_id, created_at FROM users WHERE email = $1`,
		email,
	).Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.TeamID, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *UserRepository) CreateWithTeam(ctx context.Context, name, email, passwordHash, teamName string) (*User, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var teamID string
	err = tx.QueryRowContext(ctx,
		`INSERT INTO teams (name) VALUES ($1) RETURNING id`,
		teamName,
	).Scan(&teamID)
	if err != nil {
		return nil, err
	}

	u := &User{}
	err = tx.QueryRowContext(ctx,
		`INSERT INTO users (name, email, password_hash, role, team_id)
		 VALUES ($1, $2, $3, 'ADMIN', $4)
		 RETURNING id, name, email, password_hash, role, team_id, created_at`,
		name, email, passwordHash, teamID,
	).Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.TeamID, &u.CreatedAt)
	if err != nil {
		return nil, err
	}

	return u, tx.Commit()
}
