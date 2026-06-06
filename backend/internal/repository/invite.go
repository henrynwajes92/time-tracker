package repository

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"time"
)

type InviteToken struct {
	ID        string    `json:"id"`
	Token     string    `json:"token"`
	Email     string    `json:"email"`
	TeamID    string    `json:"teamId"`
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
}

type InviteRepository struct {
	db *sql.DB
}

func NewInviteRepository(db *sql.DB) *InviteRepository {
	return &InviteRepository{db: db}
}

func (r *InviteRepository) Create(ctx context.Context, email, teamID string) (*InviteToken, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return nil, err
	}
	token := hex.EncodeToString(b)
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	inv := &InviteToken{}
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO invite_tokens (token, email, team_id, expires_at)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, token, email, team_id, expires_at, created_at`,
		token, email, teamID, expiresAt,
	).Scan(&inv.ID, &inv.Token, &inv.Email, &inv.TeamID, &inv.ExpiresAt, &inv.CreatedAt)
	return inv, err
}

func (r *InviteRepository) FindByToken(ctx context.Context, token string) (*InviteToken, error) {
	inv := &InviteToken{}
	err := r.db.QueryRowContext(ctx,
		`SELECT id, token, email, team_id, expires_at, created_at
		 FROM invite_tokens WHERE token = $1 AND expires_at > NOW()`,
		token,
	).Scan(&inv.ID, &inv.Token, &inv.Email, &inv.TeamID, &inv.ExpiresAt, &inv.CreatedAt)
	if err != nil {
		return nil, err
	}
	return inv, nil
}

func (r *InviteRepository) Delete(ctx context.Context, token string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM invite_tokens WHERE token = $1`, token)
	return err
}
