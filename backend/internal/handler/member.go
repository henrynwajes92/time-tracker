package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/henryu/time-tracker/backend/internal/middleware"
	"github.com/henryu/time-tracker/backend/internal/repository"
	"github.com/henryu/time-tracker/backend/internal/service"
)

type MemberHandler struct {
	svc *service.MemberService
}

func NewMemberHandler(svc *service.MemberService) *MemberHandler {
	return &MemberHandler{svc: svc}
}

// GET /api/team/members
func (h *MemberHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)
	members, err := h.svc.ListMembers(r.Context(), claims.TeamID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not list members"})
		return
	}
	if members == nil {
		members = []*repository.User{}
	}
	writeJSON(w, http.StatusOK, members)
}

// PATCH /api/team/members/:id/role
func (h *MemberHandler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)
	userID := chi.URLParam(r, "id")

	if userID == claims.ID {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cannot change your own role"})
		return
	}

	var req struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if err := h.svc.UpdateRole(r.Context(), userID, claims.TeamID, req.Role); err != nil {
		if errors.Is(err, service.ErrMemberNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "member not found"})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// DELETE /api/team/members/:id
func (h *MemberHandler) Remove(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)
	userID := chi.URLParam(r, "id")

	if userID == claims.ID {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cannot remove yourself"})
		return
	}

	if err := h.svc.RemoveMember(r.Context(), userID, claims.TeamID); err != nil {
		if errors.Is(err, service.ErrMemberNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "member not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not remove member"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
