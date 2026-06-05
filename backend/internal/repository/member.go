package repository

import (
	"context"
	"database/sql"
)

type MemberRepository struct {
	db *sql.DB
}

func NewMemberRepository(db *sql.DB) *MemberRepository {
	return &MemberRepository{db: db}
}

func (r *MemberRepository) ListByTeam(ctx context.Context, teamID string) ([]*User, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, name, email, role, team_id, created_at FROM users WHERE team_id = $1 ORDER BY created_at`,
		teamID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*User
	for rows.Next() {
		u := &User{}
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.TeamID, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *MemberRepository) UpdateRole(ctx context.Context, userID, teamID, role string) error {
	result, err := r.db.ExecContext(ctx,
		`UPDATE users SET role = $1 WHERE id = $2 AND team_id = $3`,
		role, userID, teamID,
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

func (r *MemberRepository) Remove(ctx context.Context, userID, teamID string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM users WHERE id = $1 AND team_id = $2`,
		userID, teamID,
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

func (r *MemberRepository) CreateMember(ctx context.Context, name, email, passwordHash, teamID string) (*User, error) {
	u := &User{}
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO users (name, email, password_hash, role, team_id)
		 VALUES ($1, $2, $3, 'MEMBER', $4)
		 RETURNING id, name, email, password_hash, role, team_id, created_at`,
		name, email, passwordHash, teamID,
	).Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.TeamID, &u.CreatedAt)
	return u, err
}
