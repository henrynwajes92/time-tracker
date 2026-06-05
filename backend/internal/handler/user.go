package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/henryu/time-tracker/backend/internal/middleware"
	"github.com/henryu/time-tracker/backend/internal/service"
)

type UserHandler struct {
	svc *service.UserService
}

func NewUserHandler(svc *service.UserService) *UserHandler {
	return &UserHandler{svc: svc}
}

// PATCH /api/users/me
func (h *UserHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
		return
	}

	user, err := h.svc.UpdateProfile(r.Context(), claims.ID, req.Name)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not update profile"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"id":    user.ID,
		"name":  user.Name,
		"email": user.Email,
		"role":  user.Role,
	})
}

// PATCH /api/users/me/password
func (h *UserHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.GetClaims(r)

	var req struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if len(req.NewPassword) < 8 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "new password must be at least 8 characters"})
		return
	}

	if err := h.svc.ChangePassword(r.Context(), claims.ID, req.CurrentPassword, req.NewPassword); err != nil {
		if errors.Is(err, service.ErrWrongPassword) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "current password is incorrect"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not change password"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
