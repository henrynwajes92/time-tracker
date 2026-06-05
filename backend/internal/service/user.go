package service

import (
	"context"
	"errors"

	"github.com/henryu/time-tracker/backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

var ErrWrongPassword = errors.New("current password is incorrect")

type UserService struct {
	repo *repository.UserRepository
}

func NewUserService(repo *repository.UserRepository) *UserService {
	return &UserService{repo: repo}
}

func (s *UserService) UpdateProfile(ctx context.Context, userID, name string) (*repository.User, error) {
	if err := s.repo.UpdateProfile(ctx, userID, name); err != nil {
		return nil, err
	}
	return s.repo.FindByID(ctx, userID)
}

func (s *UserService) ChangePassword(ctx context.Context, userID, currentPassword, newPassword string) error {
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)); err != nil {
		return ErrWrongPassword
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.repo.UpdatePassword(ctx, userID, string(hash))
}
