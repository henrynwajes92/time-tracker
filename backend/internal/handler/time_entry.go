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
