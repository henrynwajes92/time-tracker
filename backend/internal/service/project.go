package service

import (
	"context"
	"database/sql"
	"errors"

	"github.com/henryu/time-tracker/backend/internal/repository"
)

var ErrProjectNotFound = errors.New("project not found")
var ErrTaskNotFound = errors.New("task not found")

type ProjectService struct {
	projectRepo *repository.ProjectRepository
	taskRepo    *repository.TaskRepository
}

func NewProjectService(projectRepo *repository.ProjectRepository, taskRepo *repository.TaskRepository) *ProjectService {
	return &ProjectService{projectRepo: projectRepo, taskRepo: taskRepo}
}

func (s *ProjectService) List(ctx context.Context, teamID string) ([]*repository.Project, error) {
	projects, err := s.projectRepo.List(ctx, teamID)
	if err != nil {
		return nil, err
	}
	if projects == nil {
		projects = []*repository.Project{}
	}
	return projects, nil
}

func (s *ProjectService) Get(ctx context.Context, id, teamID string) (*repository.Project, []*repository.Task, error) {
	project, err := s.projectRepo.FindByID(ctx, id, teamID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil, ErrProjectNotFound
	}
	if err != nil {
		return nil, nil, err
	}

	tasks, err := s.taskRepo.ListByProject(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	if tasks == nil {
		tasks = []*repository.Task{}
	}
	return project, tasks, nil
}

func (s *ProjectService) Create(ctx context.Context, name, description, teamID string) (*repository.Project, error) {
	return s.projectRepo.Create(ctx, name, description, teamID)
}

func (s *ProjectService) Update(ctx context.Context, id, teamID, name, description string) error {
	err := s.projectRepo.Update(ctx, id, teamID, name, description)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrProjectNotFound
	}
	return err
}

func (s *ProjectService) Archive(ctx context.Context, id, teamID string) error {
	err := s.projectRepo.Archive(ctx, id, teamID)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrProjectNotFound
	}
	return err
}

func (s *ProjectService) CreateTask(ctx context.Context, name, projectID, teamID string) (*repository.Task, error) {
	// Verify project belongs to team
	_, err := s.projectRepo.FindByID(ctx, projectID, teamID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrProjectNotFound
	}
	if err != nil {
		return nil, err
	}
	return s.taskRepo.Create(ctx, name, projectID)
}

func (s *ProjectService) UpdateTask(ctx context.Context, taskID, name string) error {
	err := s.taskRepo.Update(ctx, taskID, name)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrTaskNotFound
	}
	return err
}

func (s *ProjectService) ArchiveTask(ctx context.Context, taskID string) error {
	err := s.taskRepo.Archive(ctx, taskID)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrTaskNotFound
	}
	return err
}
