package handler

import (
	"encoding/json"
	"errors"
	"fmt"
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

// GET /api/reports?from=&to=&userId=&projectId=&format=csv
func (h *TimeEntryHandler) Report(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)
	q := r.URL.Query()

	// Members can only see their own data
	userID := q.Get("userId")
	if claims.Role != "ADMIN" {
		userID = claims.ID
	}

	entries, err := h.svc.Report(r.Context(), claims.TeamID, userID, q.Get("projectId"), q.Get("from"), q.Get("to"))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "report error"})
		return
	}

	if q.Get("format") == "csv" {
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", "attachment; filename=time-report.csv")
		fmt.Fprintln(w, "Date,User,Project,Task,Description,Hours")
		for _, e := range entries {
			hours := float64(e.DurationSeconds) / 3600
			fmt.Fprintf(w, "%s,%s,%s,%s,%q,%.2f\n",
				e.StartedAt.Format("2006-01-02"),
				e.UserName, e.ProjectName, e.TaskName,
				e.Description, hours,
			)
		}
		return
	}

	writeJSON(w, http.StatusOK, entries)
}

// GET /api/dashboard
func (h *TimeEntryHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)

	active, err := h.svc.GetActive(r.Context(), claims.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "dashboard error"})
		return
	}

	todaySec, weekSec, weekDays, err := h.svc.DashboardStats(r.Context(), claims.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "dashboard stats error"})
		return
	}

	recent, err := h.svc.ListRecent(r.Context(), claims.ID, 5)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "recent entries error"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"activeTimer":   active,
		"todaySeconds":  todaySec,
		"weekSeconds":   weekSec,
		"weekDays":      weekDays,
		"recentEntries": recent,
	})
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

// PATCH /api/time-entries/:id
func (h *TimeEntryHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)
	id := chi.URLParam(r, "id")

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

	entry, err := h.svc.UpdateEntry(r.Context(), id, claims.ID, req.TaskID, req.Description, req.StartedAt, req.EndedAt)
	if errors.Is(err, service.ErrEntryNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "entry not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, entry)
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
