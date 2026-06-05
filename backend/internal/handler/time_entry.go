package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/henryu/time-tracker/backend/internal/middleware"
	"github.com/henryu/time-tracker/backend/internal/service"
)

type TimeEntryHandler struct {
	svc *service.TimeEntryService
}

func NewTimeEntryHandler(svc *service.TimeEntryService) *TimeEntryHandler {
	return &TimeEntryHandler{svc: svc}
}

// GET /api/time-entries/active
func (h *TimeEntryHandler) GetActive(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)
	entry, err := h.svc.GetActive(r.Context(), claims.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not fetch active timer"})
		return
	}
	if entry == nil {
		writeJSON(w, http.StatusOK, nil)
		return
	}
	writeJSON(w, http.StatusOK, entry)
}

// POST /api/time-entries
func (h *TimeEntryHandler) Start(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)

	var req struct {
		TaskID      string `json:"taskId"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.TaskID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "taskId is required"})
		return
	}

	entry, err := h.svc.Start(r.Context(), claims.ID, req.TaskID, req.Description)
	if errors.Is(err, service.ErrActiveTimerExists) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "a timer is already running"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not start timer"})
		return
	}
	writeJSON(w, http.StatusCreated, entry)
}

// POST /api/time-entries/:id/stop
func (h *TimeEntryHandler) Stop(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)
	id := chi.URLParam(r, "id")

	entry, err := h.svc.Stop(r.Context(), id, claims.ID)
	if errors.Is(err, service.ErrNoActiveTimer) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "no active timer found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not stop timer"})
		return
	}
	writeJSON(w, http.StatusOK, entry)
}

// POST /api/time-entries/manual
func (h *TimeEntryHandler) CreateManual(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)

	var req struct {
		TaskID      string `json:"taskId"`
		Description string `json:"description"`
		StartedAt   string `json:"startedAt"`
		EndedAt     string `json:"endedAt"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if req.TaskID == "" || req.StartedAt == "" || req.EndedAt == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "taskId, startedAt and endedAt are required"})
		return
	}

	entry, err := h.svc.CreateManual(r.Context(), claims.ID, req.TaskID, req.Description, req.StartedAt, req.EndedAt)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, entry)
}

// DELETE /api/time-entries/:id
func (h *TimeEntryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)
	id := chi.URLParam(r, "id")

	if err := h.svc.Delete(r.Context(), id, claims.ID); err != nil {
		if errors.Is(err, service.ErrEntryNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "entry not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not delete entry"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/time-entries
func (h *TimeEntryHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)
	entries, err := h.svc.ListRecent(r.Context(), claims.ID, 50)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not list entries"})
		return
	}
	writeJSON(w, http.StatusOK, entries)
}
