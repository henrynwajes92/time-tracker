package service

import (
	"context"
	"database/sql"
	"errors"

	"github.com/henryu/time-tracker/backend/internal/repository"
)

var ErrMemberNotFound = errors.New("member not found")

type MemberService struct {
	repo *repository.MemberRepository
}

func NewMemberService(repo *repository.MemberRepository) *MemberService {
	return &MemberService{repo: repo}
}

func (s *MemberService) ListMembers(ctx context.Context, teamID string) ([]*repository.User, error) {
	return s.repo.ListByTeam(ctx, teamID)
}

func (s *MemberService) UpdateRole(ctx context.Context, userID, teamID, role string) error {
	if role != "ADMIN" && role != "MEMBER" {
		return errors.New("invalid role")
	}
	err := s.repo.UpdateRole(ctx, userID, teamID, role)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrMemberNotFound
	}
	return err
}

func (s *MemberService) RemoveMember(ctx context.Context, userID, teamID string) error {
	err := s.repo.Remove(ctx, userID, teamID)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrMemberNotFound
	}
	return err
}
