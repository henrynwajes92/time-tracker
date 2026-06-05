package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/henryu/time-tracker/backend/internal/middleware"
	"github.com/henryu/time-tracker/backend/internal/service"
)

type ProjectHandler struct {
	svc *service.ProjectService
}

func NewProjectHandler(svc *service.ProjectService) *ProjectHandler {
	return &ProjectHandler{svc: svc}
}

// GET /api/projects
func (h *ProjectHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)
	projects, err := h.svc.List(r.Context(), claims.TeamID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not list projects"})
		return
	}
	writeJSON(w, http.StatusOK, projects)
}

// POST /api/projects
func (h *ProjectHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
		return
	}

	project, err := h.svc.Create(r.Context(), req.Name, req.Description, claims.TeamID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not create project"})
		return
	}
	writeJSON(w, http.StatusCreated, project)
}

// GET /api/projects/:id
func (h *ProjectHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)
	id := chi.URLParam(r, "id")

	project, tasks, err := h.svc.Get(r.Context(), id, claims.TeamID)
	if errors.Is(err, service.ErrProjectNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "project not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not fetch project"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"project": project, "tasks": tasks})
}

// PATCH /api/projects/:id
func (h *ProjectHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)
	id := chi.URLParam(r, "id")

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
		return
	}

	if err := h.svc.Update(r.Context(), id, claims.TeamID, req.Name, req.Description); err != nil {
		if errors.Is(err, service.ErrProjectNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "project not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not update project"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// DELETE /api/projects/:id
func (h *ProjectHandler) Archive(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)
	id := chi.URLParam(r, "id")

	if err := h.svc.Archive(r.Context(), id, claims.TeamID); err != nil {
		if errors.Is(err, service.ErrProjectNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "project not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not archive project"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// POST /api/projects/:id/tasks
func (h *ProjectHandler) CreateTask(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)
	projectID := chi.URLParam(r, "id")

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
		return
	}

	task, err := h.svc.CreateTask(r.Context(), req.Name, projectID, claims.TeamID)
	if errors.Is(err, service.ErrProjectNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "project not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not create task"})
		return
	}
	writeJSON(w, http.StatusCreated, task)
}

// PATCH /api/tasks/:id
func (h *ProjectHandler) UpdateTask(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
		return
	}

	if err := h.svc.UpdateTask(r.Context(), id, req.Name); err != nil {
		if errors.Is(err, service.ErrTaskNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "task not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not update task"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// DELETE /api/tasks/:id
func (h *ProjectHandler) ArchiveTask(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if err := h.svc.ArchiveTask(r.Context(), id); err != nil {
		if errors.Is(err, service.ErrTaskNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "task not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not archive task"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
