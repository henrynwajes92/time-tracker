package service

import (
	"context"
	"errors"

	"github.com/henryu/time-tracker/backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

var ErrEmailTaken = errors.New("email already in use")

type AuthService struct {
	repo *repository.UserRepository
}

func NewAuthService(repo *repository.UserRepository) *AuthService {
	return &AuthService{repo: repo}
}

func (s *AuthService) VerifyCredentials(ctx context.Context, email, password string) (*repository.User, error) {
	user, err := s.repo.FindByEmail(ctx, email)
	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	return user, nil
}

func (s *AuthService) Register(ctx context.Context, name, email, password, teamName string) (*repository.User, error) {
	exists, _ := s.repo.FindByEmail(ctx, email)
	if exists != nil {
		return nil, ErrEmailTaken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return nil, err
	}

	return s.repo.CreateWithTeam(ctx, name, email, string(hash), teamName)
}
