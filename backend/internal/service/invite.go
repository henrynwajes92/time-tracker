package service

import (
	"context"
	"database/sql"
	"errors"

	"github.com/henryu/time-tracker/backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

var ErrInviteNotFound = errors.New("invite not found or expired")
var ErrInviteEmailMismatch = errors.New("email does not match invite")

type InviteService struct {
	inviteRepo *repository.InviteRepository
	memberRepo *repository.MemberRepository
	userRepo   *repository.UserRepository
}

func NewInviteService(inviteRepo *repository.InviteRepository, memberRepo *repository.MemberRepository, userRepo *repository.UserRepository) *InviteService {
	return &InviteService{inviteRepo: inviteRepo, memberRepo: memberRepo, userRepo: userRepo}
}

func (s *InviteService) CreateInvite(ctx context.Context, email, teamID, createdBy string) (*repository.InviteToken, error) {
	return s.inviteRepo.Create(ctx, email, teamID, createdBy)
}

func (s *InviteService) GetInvite(ctx context.Context, token string) (*repository.InviteToken, error) {
	inv, err := s.inviteRepo.FindByToken(ctx, token)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrInviteNotFound
	}
	return inv, err
}

func (s *InviteService) AcceptInvite(ctx context.Context, token, name, email, password string) (*repository.User, error) {
	inv, err := s.inviteRepo.FindByToken(ctx, token)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrInviteNotFound
	}
	if err != nil {
		return nil, err
	}

	if inv.Email != "" && inv.Email != email {
		return nil, ErrInviteEmailMismatch
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user, err := s.memberRepo.CreateMember(ctx, name, email, string(hash), inv.TeamID)
	if err != nil {
		return nil, err
	}

	_ = s.inviteRepo.Delete(ctx, token)
	return user, nil
}
