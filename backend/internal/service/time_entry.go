package service

import (
	"context"
	"database/sql"
	"errors"

	"github.com/henryu/time-tracker/backend/internal/repository"
)

var ErrActiveTimerExists = errors.New("a timer is already running")
var ErrNoActiveTimer = errors.New("no active timer found")

type TimeEntryService struct {
	repo *repository.TimeEntryRepository
}

func NewTimeEntryService(repo *repository.TimeEntryRepository) *TimeEntryService {
	return &TimeEntryService{repo: repo}
}

func (s *TimeEntryService) GetActive(ctx context.Context, userID string) (*repository.TimeEntry, error) {
	entry, err := s.repo.FindActive(ctx, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return entry, err
}

func (s *TimeEntryService) Start(ctx context.Context, userID, taskID, description string) (*repository.TimeEntry, error) {
	existing, err := s.repo.FindActive(ctx, userID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	if existing != nil {
		return nil, ErrActiveTimerExists
	}
	return s.repo.Start(ctx, userID, taskID, description)
}

func (s *TimeEntryService) Stop(ctx context.Context, id, userID string) (*repository.TimeEntry, error) {
	entry, err := s.repo.Stop(ctx, id, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNoActiveTimer
	}
	return entry, err
}

func (s *TimeEntryService) ListRecent(ctx context.Context, userID string, limit int) ([]*repository.TimeEntry, error) {
	entries, err := s.repo.List(ctx, userID, limit)
	if err != nil {
		return nil, err
	}
	if entries == nil {
		entries = []*repository.TimeEntry{}
	}
	return entries, nil
}
